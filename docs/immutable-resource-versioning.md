# **OCS Official Guide: Immutable Resource Versioning**

**Capability ID:** `dev.ocs.resource.versioning@1.0`
**Status:** **Final 1.0**
**Applies To:** Core OCS resources requiring an audit trail (e.g., Order, Cart, User Profile).

## **1. Introduction & Core Philosophy**

### 1.1 The Flaw of Traditional APIs in Commerce
Most REST APIs are built on a mutable CRUD (Create, Read, Update, Delete) model. An "update" is typically a `PATCH` or `PUT` request that overwrites data in a database record. While simple for basic applications, this model is fundamentally unsuited for systems where integrity, auditability, and history are paramount, such as digital commerce.

The mutable approach introduces critical risks:
*   **Data Loss:** When a user changes their shipping address, the original address is gone forever. This makes resolving disputes or auditing financial calculations impossible.
*   **Stateful Complexity:** A single change can trigger a cascade of side effects (tax recalculation, shipping cost changes, fraud re-analysis). Performing these updates atomically on a live record is a complex, error-prone process that often leads to race conditions and inconsistent data.
*   **Lack of Traceability:** It is difficult to answer critical business questions like "What sequence of events led to this order being flagged for fraud?" or "Who authorized this refund and when?"

### 1.2 The Immutable Solution: Treating State as a Sequence of Events
This capability transforms the OCS standard by adopting a core principle from event sourcing and financial ledger systems: **every change of state is an event that creates a new, immutable version of the resource.**

An "update" is no longer a destructive `PATCH`. It is a creative `POST` to an action endpoint that results in a **new resource with a new ID**, which supersedes the previous one.

**The Immutable Flow:**
```
// Client requests a change via a discoverable hypermedia action
POST /orders/order_abc1/change-address
{ "deliveryAddress": "456 New Ave, Newville, USA" }

// The server responds by CREATING a new resource version
--> 201 Created
--> Location: /orders/order_def2 // <-- A NEW, UNIQUE ID
```
A new order version (`order_def2`) is created, and the old version (`order_abc1`) is preserved as a historical record. This forms an unbreakable, auditable chain of states—a "Markovian edit chain"—where each link is a complete, valid, and timestamped snapshot of the resource. This is not just a feature; it is a guarantee of data integrity.

---

## **2. Formal Specification**

### 2.1 Capability ID
`dev.ocs.resource.versioning@1.0`

### 2.2 Description
Indicates that a resource supports immutable versioning. Mutations create a new version of the resource with a new, unique ID, forming a linked chain of historical states. This capability is advertised server-wide in `GET /capabilities`, and its metadata is embedded in the specific resources that support it.

### 2.3 Metadata Schema
When a resource implements this capability, it **MUST** include the following metadata block:

| Field | Type | Description |
| :--- | :--- | :--- |
| `_version` | String | The version of this capability schema. Always `"1.0"`. |
| `version` | Integer | A sequential, human-readable version number for the resource (e.g., 1, 2, 3). Used for display purposes; **do not** use for identity. |
| `revises` | String \| Null | The unique ID of the resource version this one supersedes. `null` for the first version. This forms the backward link in the chain. |
| `isLatest` | Boolean | `true` if this is the current, active version of the resource. A critical flag for clients to identify the canonical state. |
| `supersededBy` | String | **(Optional)** The unique ID of the resource version that has superseded this one. Only present if `isLatest` is `false`. This forms the forward link in the chain. |
| `revisionDetails` | Object \| Null | An audit record of the change that created this version. `null` for the first version. |
| ↳ `actionId` | String | The `id` of the hypermedia action that triggered this revision (e.g., `change_address`). |
| ↳ `timestamp` | String | ISO 8601 timestamp of when the revision occurred. |
| ↳ `arguments` | Object | A copy of the request body or key arguments that caused the change. |

### 2.4 Resource Status Convention
A versioned resource that is no longer the latest version **SHOULD** have its primary `status` field changed to `superseded`.

---

## **3. Server Implementation Guide (The Rulebook)**

### 3.1 Advertising the Capability
Your `GET /capabilities` endpoint **MUST** include `dev.ocs.resource.versioning@1.0` to signal to all clients that they must be prepared to handle the versioning contract.

### 3.2 Resource IDs: A Critical Best Practice
Resource IDs **MUST** be unique and non-sequential for each new version. Using predictable suffixes like `_v1`, `_v2` is an anti-pattern that leaks information.
*   **Recommended:** Use UUIDs or another high-entropy unique identifier for every resource version.
*   The `version` field in the metadata provides the human-readable sequence, while the `id` guarantees uniqueness.

### 3.3 The Atomic Mutation Transaction
Implementing a mutation action endpoint (e.g., `POST /orders/{id}/change-address`) is the most critical part of the server logic. The entire operation **MUST** be performed within a single database transaction.

**The Transactional Sequence:**
1.  **Fetch & Lock:** Retrieve the current resource version from the database. It's recommended to lock the row to prevent concurrent modifications.
2.  **Validate:**
    *   Confirm that the resource's `isLatest` flag is `true`. If not, immediately return a `409 Conflict` error to prevent operating on a stale version.
    *   Validate that the requested action is permissible given the resource's current state (e.g., you cannot change the address on a `shipped` order).
3.  **Create New Version:**
    *   Generate a new unique ID.
    *   Create a new resource record in your database, copying data from the previous version and applying the validated changes.
    *   Populate the versioning metadata (`version`, `revises`, `isLatest: true`, `revisionDetails`).
4.  **Update Old Version:**
    *   Modify the previous version's record: set `isLatest` to `false`, `status` to `superseded`, and add the `supersededBy` field pointing to the new version's ID.
    *   Remove all hypermedia `actions` from the old version. It is now a read-only historical artifact.
5.  **Commit Transaction:** If every step succeeds, commit the transaction. If any step fails, the transaction **MUST** be rolled back, leaving the system state completely unchanged.
6.  **Respond to Client:** On success, return:
    *   An HTTP status code of `201 Created`.
    *   A `Location` header containing the full URL of the newly created resource version.
    *   The full JSON object of the new resource version in the response body.

### 3.4 Real-Time Integration with SSE and JSON Patch
When a resource is versioned, broadcast the change efficiently to all subscribed clients.

1.  **Broadcast on the Old Channel:** Send the update on the SSE channel of the *old* resource ID (e.g., `/orders/order_abc1/updates`).
2.  **Use a Root `replace` Patch:** The payload should be a single, atomic JSON Patch operation that replaces the entire resource. This is the unambiguous signal of a version change.

    ```
    event: order.patch
    data: [
      {
        "op": "replace",
        "path": "/",
        "value": { /* ... full new resource object, including new ID and metadata ... */ }
      }
    ]
    ```

3.  **Signal Channel Closure (Optional but Recommended):** After sending the patch, send a final, custom event to explicitly tell clients that this stream is now defunct.

    ```
    event: resource.superseded
    data: { "supersededBy": "order_def2" }
    ```
4.  The server can then safely close the connection for the old SSE channel.

### 3.5 Mitigating Common Challenges
*   **Storage Growth:** Plan for increased storage. Implement a data lifecycle policy to move non-latest versions to a cheaper "cold storage" tier after a defined period (e.g., 90 days post-completion). The API should still be able to retrieve these historical records.
*   **History Retrieval:** To avoid chatty clients, provide a convenience endpoint like `GET /orders/{id}/history` that returns the entire ordered version chain in a single response.
*   **Concurrency Control (Optimistic Locking):** To handle cases where two users try to modify the same resource simultaneously, require the client to include the version number it is revising in its request.
    ```
    POST /orders/order_abc1/change-address
    {
      "revisingVersion": 1, // <-- Client indicates which version it's editing
      "deliveryAddress": "..."
    }
    ```
    The server can then check if `revisingVersion` matches the current latest version. If not, another user has made a change in the meantime, and the server should reject the request with `409 Conflict`.

---

## **4. Client Implementation Guide (The Playbook)**

### 4.1 The Golden Rule: State Management on `201 Created`
The most critical responsibility for a client interacting with a versioned resource is correctly handling the response to a mutation request. A `201 Created` response is a signal that the identity of the resource has changed.

**Your client logic MUST:**
1.  **Recognize the `201 Created` status code** as a successful versioning event.
2.  **Extract the new resource URL** from the `Location` header. The ID in this URL is the new primary key for the resource.
3.  **Use the JSON response body** as the new, canonical state of the object.
4.  **Update all internal state references.** This is the step where most implementations fail. Any variables, UI components, or data stores (e.g., Redux, React Query cache) that reference the old ID **MUST** be updated to the new ID.

```javascript
async function performMutation(action, payload) {
  const response = await fetch(action.href, { /* ... */ });

  if (response.status === 201) {
    const newVersion = await response.json();
    const newLocation = response.headers.get('Location');
    
    // **CRITICAL:** This function MUST update your application's global state,
    // replacing all instances of the old ID and data.
    updateApplicationState(action.resourceId, newVersion, newLocation);
    
    return newVersion;
  }
  // ... handle errors ...
}
```

### 4.2 Handling Real-Time Updates (SSE)
Your SSE handler must be version-aware.

1.  **Listen for the Root `replace` Patch:** This is your primary signal for a version change.
2.  **Update State and Re-subscribe:** When this patch arrives:
    *   Replace your entire local object with the `value` from the patch.
    *   Check if `newObject.id !== oldObject.id`.
    *   If the ID has changed, **close the current SSE connection** and **open a new one** to the update URL of the new version (e.g., `/orders/{new_id}/updates`).

### 4.3 Mitigating Common Challenges
*   **Stale URLs (Bookmarks/Email Links):** When fetching a resource, always check the `isLatest` flag. If it's `false`, use the `supersededBy` link to traverse the chain until you reach the latest version. This prevents the user from viewing or acting upon outdated information.
*   **Official SDKs:** The complexity of client-side state management is the strongest argument for providing an official SDK. A well-designed SDK can abstract this entire process, making mutation a simple method call that transparently handles the `201` response and state updates.

    ```javascript
    // Hypothetical SDK that hides the complexity
    let order = await ocsClient.getOrder('order_abc1');
    order = await order.performAction('change_address', { ... });
    console.log(order.id); // --> "order_def2"
    ```

### 4.4 Advanced Topic: GraphQL
While OCS is a REST-based standard, these principles are directly applicable to GraphQL. A mutation like `changeOrderAddress` would return the *new* `Order` type. The client would then be responsible for updating its Apollo/Relay cache to replace the old object with the new one, using the new `id`. The core principle of returning a new identity remains the same.

**(Continuing the Official Guide)**

## **5. Integration with Core OCS Concepts**

An immutable versioning system must be deeply integrated with the standard's other core concepts, particularly authentication, authorization, and error handling. It also needs a clear strategy for how it interacts with evolving schemas.

### 5.1 Authentication and Authorization (Ownership)

Authentication (`who you are`) and authorization (`what you can do`) are paramount when dealing with resource mutations. The immutable versioning pattern enhances security by providing a clear audit trail.

**Server-Side Rules:**

1.  **Authorization on Action, Not Just Resource:** When a client initiates a mutation (e.g., `POST /orders/{id}/change-address`), the server **MUST** perform an authorization check. The check isn't just "can the user see this order?" but "is the user authorized to perform the `change_address` action on this order in its current state?" This is typically determined by business logic (e.g., is the user the order's owner? are they a customer service agent with specific permissions?).

2.  **Preservation of Ownership:** When a new resource version is created, it **MUST** inherit the ownership and access control list (ACL) of its predecessor. A user who owned `order_v1` must automatically own `order_v2`. Losing ownership during a version change would be a critical security flaw.

3.  **Recording the Actor:** The `revisionDetails` block provides a natural place to record *who* initiated the change. The server should populate this from the authenticated user's context.

    **Expanded `revisionDetails` Schema:**
    ```json
    "revisionDetails": {
      "actionId": "change_address",
      "timestamp": "...",
      "arguments": { ... },
      "actor": { // <-- NEW
        "type": "user", // or "system", "agent"
        "id": "user_12345"
      }
    }
    ```
    This `actor` field makes the audit trail complete, answering not just what changed, but *who* changed it.

**Client-Side Considerations:**

*   Clients should never assume an action is available. The presence of an action in the `actions` array of a resource is the server's explicit signal that the currently authenticated user is authorized to perform it. If the action isn't present, the UI to trigger it should be hidden or disabled.

### 5.2 Comprehensive Error Handling

A robust system plans for failure. The versioning process can fail in several ways, and the API must communicate these failures clearly using RFC 9457 Problem Details.

**Common Error Scenarios:**

1.  **`409 Conflict` - Stale Version:** This is the most important error. If a client attempts to mutate a version that is no longer the latest (`isLatest: false`), the server **MUST** return a `409 Conflict`. This prevents "lost update" problems where two users edit the same version.

    **Error Response Body:**
    ```json
    {
      "type": "https://schemas.ocs.dev/errors/stale-version",
      "title": "Stale Version",
      "status": 409,
      "detail": "The resource version you are trying to modify has been superseded. Please fetch the latest version and re-apply your changes.",
      "instance": "/orders/order_abc1/change-address",
      "latestVersionUrl": "/orders/order_def2" // <-- Link to the latest version
    }
    ```
    **Client Recovery:** The client should use the `latestVersionUrl` to fetch the new state, and then either re-apply its changes automatically (if possible) or prompt the user to resolve the conflict.

2.  **`403 Forbidden` - Unauthorized Action:** If the authenticated user is not permitted to perform the requested action (e.g., trying to cancel an order that isn't theirs).

    **Error Response Body:**
    ```json
    {
      "type": "https://schemas.ocs.dev/errors/action-not-permitted",
      "title": "Action Not Permitted",
      "status": 403,
      "detail": "You do not have permission to perform the 'cancel' action on this order."
    }
    ```

3.  **`422 Unprocessable Entity` - Validation Failed:** If the arguments for the action are invalid (e.g., an invalid address format, an attempt to add an out-of-stock item). This is a standard validation error.

4.  **`500 Internal Server Error` - Transaction Failed:** If the database transaction fails for an unexpected reason, the server should roll back all changes and return a generic `500` error, indicating that the client can safely retry the operation later.

### 5.3 Schema Evolution (New Schemas vs. Old Schemas)

This is a subtle but critical point. Resources exist over time, and during that time, their schemas may change. For example, the `Order` schema might evolve from `v1` to `v2`, adding a new field like `loyaltyPointsEarned`.

The immutable versioning pattern provides a perfect mechanism for handling this gracefully.

**The Rule of Schema Consistency:**
**Each immutable resource version is permanently associated with the schema version that was active at the time of its creation.**

**How It Works in Practice:**

1.  **The Server Upgrades:** The server deploys a new version of its software that uses `Order` schema `v2`.
2.  **An Old Order is Mutated:** A customer views an old order, `order_abc1`, which was created using `Order` schema `v1`. They initiate an address change.
3.  **The New Version Uses the New Schema:** The server creates the new version, `order_def2`. This new version **MUST** conform to the currently active `Order` schema `v2`. It will now include the `loyaltyPointsEarned` field, which the server calculates as part of the mutation logic.
4.  **The Old Version Remains Unchanged:** The historical record, `order_abc1`, remains a perfect, byte-for-byte representation of an `Order` object as defined by schema `v1`. It does not retroactively gain the `loyaltyPointsEarned` field.

**Benefits of this Approach:**

*   **Historical Accuracy:** Your data history is a true reflection of your data structures over time. You can always deserialize an old version with the old schema and get a valid object.
*   **Simplified Migration:** There is no need for large, risky "big bang" data migration scripts that update millions of old records. Data is migrated forward, one resource at a time, as it is actively mutated.
*   **Client Compatibility:** A client can look at the `revisionDetails.timestamp` of a version to infer which schema it likely conforms to, allowing for backward-compatible parsing if necessary.

**Server Responsibility:** The server's API serialization layer must be able to handle requests for old versions and present them according to their original schema, while presenting new versions according to the new schema. This can be managed by storing a `_schemaVersion` field alongside the resource data in the database.

---
**(Final Section for the Guide)**

## **6. Complete Lifecycle Example: Order from Creation to Revision**

Let's trace an order through its entire lifecycle to see all concepts in action.

**Scenario:** The server has just upgraded its `Order` schema to `v2`.

1.  **Creation (Schema v1):**
    *   `POST /orders` -> `201 Created`
    *   **Response:** `order_abc1` is created. It conforms to `Order` schema `v1`. Its metadata shows `version: 1`, `revises: null`, `isLatest: true`. The `revisionDetails` block is `null`. The `actor` is the customer who placed the order.

2.  **A Week Passes. Server is upgraded to Schema v2.**

3.  **Mutation (Address Change):**
    *   Customer is authenticated and views `order_abc1`. The server shows the `change_address` action because the order is not yet shipped.
    *   `POST /orders/order_abc1/change-address` with a new address and `revisingVersion: 1`.
    *   Server validates the request. The `revisingVersion` matches.
    *   Server begins a transaction.
    *   It creates `order_def2`, which **conforms to `Order` schema `v2`**, including any new fields.
    *   Metadata for `order_def2`: `version: 2`, `revises: "order_abc1"`, `isLatest: true`. `revisionDetails` captures the action, timestamp, arguments, and the customer as the `actor`.
    *   Metadata for `order_abc1` is updated: `isLatest: false`, `status: "superseded"`, `supersededBy: "order_def2"`.
    *   Server commits the transaction.
    *   **Response:** `201 Created`, `Location: /orders/order_def2`, and the full `order_def2` object.
    *   **SSE Broadcast:** A root `replace` patch is sent on `/orders/order_abc1/updates` containing the full `order_def2` object.

4.  **Concurrent Mutation Attempt (Stale Write):**
    *   Simultaneously, a customer service agent who was viewing `order_abc1` tries to add a note.
    *   `POST /orders/order_abc1/add-note` with `revisingVersion: 1`.
    *   The server receives the request but sees that the latest version is now `2` (`order_def2`).
    *   **Response:** `409 Conflict` with a link to `latestVersionUrl: "/orders/order_def2"`. The agent's client software can now fetch the latest version and retry adding the note.