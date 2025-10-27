/**
 * Simple OCP Client - Bare Minimum Example
 *
 * This shows the simplest possible OCP client that can:
 * 1. Discover server capabilities
 * 2. Browse products
 * 3. Place an order
 *
 * No frameworks, no dependencies, just fetch() and async/await.
 * Perfect for learning or prototyping.
 */

const BASE_URL = 'https://shop.example.com';
const AUTH_TOKEN = 'your_bearer_token_here';

// Helper: Make authenticated requests
async function ocpRequest(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/ocp+json; version=1.0',
      'Accept': 'application/ocp+json; version=1.0',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    // RFC 9457 compliant error handling with extensions
    console.error(`Error (${error.status}): ${error.title}`);
    console.error(`Detail: ${error.detail}`);
    if (error.localizationKey) {
      console.error(`Localization Key: ${error.localizationKey}`);
    }
    if (error.nextActions) {
      console.error('Suggested Actions:', error.nextActions.map(a => `${a.title} (${a.method} ${a.href})`).join(', '));
    }
    throw new Error(`${error.title}: ${error.detail}`);
  }

  return response.json();
}

// Step 1: Discover what the server supports
async function getCapabilities() {
  console.log('📋 Discovering server capabilities...');
  const data = await ocpRequest('/capabilities');

  console.log('✅ Server supports:');
  data.capabilities.forEach(cap => {
    console.log(`   - ${cap.id}`);
  });

  return data.capabilities;
}

// Step 2: Browse available products
async function browseProducts(catalogId = 'main') {
  console.log('\n🛍️  Browsing catalog...');
  const catalog = await ocpRequest(`/catalogs/${catalogId}`);

  console.log(`✅ Found ${catalog.items.length} products in "${catalog.name}":`);
  catalog.items.forEach(item => {
    console.log(`   - ${item.name}: ${item.price.amount} ${item.price.currency}`);
    console.log(`     (${item.fulfillmentType}, ${item.available ? 'available' : 'sold out'})`);
  });

  return catalog.items;
}

// Step 3: Place a simple order (no cart)
async function placeOrder(items, address) {
  console.log('\n📦 Placing order...');

  const orderData = {
    items: items.map(item => ({
      catalogItemId: item.catalogItemId,
      quantity: item.quantity,
    })),
  };

  // Add address if needed (for physical items)
  if (address) {
    orderData.deliveryAddress = { address };
  }

  const order = await ocpRequest('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });

  console.log(`✅ Order placed! ID: ${order.id}`);
  console.log(`   Status: ${order.status}`);
  console.log(`   Total: ${order.total?.amount} ${order.total?.currency}`);

  return order;
}

// Step 4: Check order status
async function checkOrderStatus(orderId) {
  console.log(`\n🔍 Checking order ${orderId}...`);
  const order = await ocpRequest(`/orders/${orderId}`);

  console.log(`✅ Order status: ${order.status}`);
  return order;
}

// Main flow: Complete shopping journey
async function main() {
  try {
    console.log('🚀 Starting OCP client demo\n');

    // 1. Check capabilities
    const capabilities = await getCapabilities();

    // 2. Browse products
    const products = await browseProducts('main');

    // 3. Pick first available product
    const product = products.find(p => p.available);
    if (!product) {
      console.log('❌ No products available');
      return;
    }

    // 4. Place order
    const order = await placeOrder(
      [{ catalogItemId: product.id, quantity: 1 }],
      product.fulfillmentType === 'physical' ? '123 Main St, Anytown, USA' : null
    );

    // 5. Check status
    await checkOrderStatus(order.id);

    console.log('\n✨ Demo complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// --- Advanced Example: Using a Cart ---

async function cartBasedFlow() {
  console.log('🛒 Starting cart-based flow\n');

  try {
    // 1. Create cart
    console.log('Creating cart...');
    const cart = await ocpRequest('/carts', {
      method: 'POST',
      body: JSON.stringify({ storeId: 'main' }),
    });
    console.log(`✅ Cart created: ${cart.id}`);

    // 2. Browse products
    const products = await browseProducts('main');

    // 3. Add items to cart
    for (const product of products.slice(0, 2)) {
      if (!product.available) continue;

      console.log(`\nAdding ${product.name} to cart...`);
      await ocpRequest(`/carts/${cart.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          catalogItemId: product.id,
          quantity: 1,
        }),
      });
      console.log('✅ Added');
    }

    // 4. Get final cart state
    console.log('\n📋 Getting final cart...');
    const finalCart = await ocpRequest(`/carts/${cart.id}`);
    console.log(`Total: ${finalCart.total.amount} ${finalCart.total.currency}`);

    // 5. Checkout
    const hasPhysical = finalCart.items.some(
      item => item.fulfillmentType === 'physical'
    );

    const order = await ocpRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({
        cartId: cart.id,
        ...(hasPhysical && {
          deliveryAddress: { address: '123 Main St, Anytown, USA' },
        }),
      }),
    });

    console.log(`\n✅ Order placed: ${order.id}`);
    console.log('✨ Cart-based flow complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// --- Example: Working with Product Variants ---

async function variantExample() {
  console.log('👕 Product variants example\n');

  try {
    const products = await browseProducts('apparel');

    // Find a product with variants
    const productWithVariants = products.find(
      p => p.metadata && p.metadata['dev.ocp.product.variants@1.0']
    );

    if (!productWithVariants) {
      console.log('No variant products found');
      return;
    }

    const variants = productWithVariants.metadata['dev.ocp.product.variants@1.0'];

    console.log(`Product: ${productWithVariants.name}`);
    console.log(`Options: ${variants.options.join(', ')}`);
    console.log('\nAvailable variants:');

    variants.variants.forEach(v => {
      console.log(`  - ${v.values.join(' / ')}: ${v.price.amount} ${v.price.currency}`);
      console.log(`    Stock: ${v.stock}, ID: ${v.id}`);
    });

    // Create order with specific variant
    const selectedVariant = variants.variants.find(v => v.stock > 0);
    if (selectedVariant) {
      console.log(`\n📦 Ordering: ${selectedVariant.values.join(' / ')}`);

      const order = await placeOrder(
        [{
          catalogItemId: productWithVariants.id,
          variantId: selectedVariant.id,
          quantity: 1,
        }],
        '123 Main St, Anytown, USA'
      );
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// --- Example: Real-time Order Updates ---

function subscribeToOrderUpdates(orderId) {
  console.log(`📡 Subscribing to updates for order ${orderId}...\n`);

  const eventSource = new EventSource(
    `${BASE_URL}/orders/${orderId}/updates`,
    {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    }
  );

  eventSource.addEventListener('order.patch', (event) => {
    const patches = JSON.parse(event.data);

    console.log('📬 Order update received:');
    patches.forEach(patch => {
      console.log(`   ${patch.op} ${patch.path} → ${JSON.stringify(patch.value)}`);
    });
  });

  eventSource.onerror = (error) => {
    console.error('❌ SSE Error:', error);
    eventSource.close();
  };

  return eventSource;
}

// --- Example: Immutable Resource Revisions ---

async function revisionExample() {
  console.log('\n🔄 Demonstrating immutable resource revision...\n');
  try {
    // 1. Create an initial order
    console.log('Creating initial order...');
    const orderV1 = await ocpRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ catalogItemId: 'coffee_mug', quantity: 1 }],
        deliveryAddress: { address: '123 Main St' }
      }),
    });
    console.log(`✅ Order V1 created with ID: ${orderV1.id}`);

    // 2. Find the 'cancel' action on V1
    const cancelAction = orderV1.actions.find(a => a.id === 'cancel');
    if (!cancelAction) {
      throw new Error('Could not find "cancel" action on Order V1.');
    }
    console.log(`Found 'cancel' action: POST ${cancelAction.href}`);

    // 3. Execute the action, expecting a new version
    console.log('\nExecuting cancel action...');
    const response = await fetch(`${BASE_URL}${cancelAction.href}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
        'Accept': 'application/ocp+json; version=1.0',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({ reason: 'Client test' })
    });

    if (response.status !== 201) {
      throw new Error(`Expected status 201, but got ${response.status}`);
    }

    // 4. Handle the 201 Created response - THIS IS THE GOLDEN RULE
    const orderV2 = await response.json();
    console.log('✅ Received 201 Created. A new version was made.');
    console.log(`   Order V2 ID: ${orderV2.id}`);
    console.log(`   V2 revises V1: ${orderV2.metadata['dev.ocp.resource.versioning@1.0'].revises === orderV1.id}`);
    console.log(`   V2 status: ${orderV2.status}`);

    // 5. Verify the old version is now superseded
    console.log('\nVerifying old version status...');
    const oldOrderResponse = await ocpRequest(`/orders/${orderV1.id}`);
    console.log(`✅ Order V1 is now 'superseded': ${oldOrderResponse.status === 'superseded'}`);
    console.log(`   V1 isLatest is false: ${oldOrderResponse.metadata['dev.ocp.resource.versioning@1.0'].isLatest === false}`);
    console.log(`   V1 superseded by V2: ${oldOrderResponse.metadata['dev.ocp.resource.versioning@1.0'].supersededBy === orderV2.id}`);

    console.log('\n✨ Revision demo complete!');
  } catch (error) {
    console.error('❌ Revision Example Error:', error.message);
  }
}

// --- Example: Working with Rich Product Info ---

async function richInfoExample() {
  console.log('📄 Rich product info example\n');
  try {
    const products = await browseProducts('main');

    // Find a product with rich_info
    const productWithRichInfo = products.find(
      p => p.metadata && p.metadata['dev.ocp.product.rich_info@1.0']
    );

    if (!productWithRichInfo) {
      console.log('No products with rich info found in the "main" catalog.');
      return;
    }

    console.log(`Product: "${productWithRichInfo.name}"`);

    const richInfo = productWithRichInfo.metadata['dev.ocp.product.rich_info@1.0'];

    // Demonstrate fallback logic (progressive enhancement)
    const displayName = richInfo?.names?.customerFacing || productWithRichInfo.name;
    const shortName = richInfo?.names?.short || productWithRichInfo.name;

    console.log(`\n📝 Names:`);
    console.log(`  Customer-Facing: "${displayName}"`);
    console.log(`  Short (for cart): "${shortName}"`);
    console.log(`  Backend: "${richInfo?.names?.backend || 'N/A'}"`);

    console.log(`\n📋 Descriptions:`);
    console.log(`  Short: "${richInfo?.descriptions?.short?.substring(0, 60)}..."`);

    console.log(`\n🔍 SEO:`);
    if (richInfo?.seo) {
      console.log(`  Meta Title: "${richInfo.seo.metaTitle}"`);
      console.log(`  Slug: "${richInfo.seo.slug}"`);
    }

    console.log(`\n✨ Key Features:`);
    richInfo?.keyFeatures?.forEach((feature, i) => {
      console.log(`  ${i + 1}. ${feature}`);
    });

    console.log(`\n🖼️  Image Gallery: ${richInfo?.imageGallery?.length || 0} images`);

    console.log(`\n📅 Content Info:`);
    console.log(`  Last Modified: ${richInfo.lastModified}`);
    console.log(`  Author: ${richInfo.authorRef}`);
    console.log(`  Status: ${richInfo.publicationStatus}`);

    // Check for variant-specific rich info
    if (richInfo.variants && richInfo.variants.length > 0) {
      console.log(`\n🎨 Variant-Specific Rich Info:`);
      const variants = productWithRichInfo.metadata['dev.ocp.product.variants@1.0']?.variants;
      richInfo.variants.forEach(vri => {
        const variant = variants?.find(v => v.id === vri.variantId);
        const variantName = variant ? variant.values.join('/') : vri.variantId;
        console.log(`  - ${variantName}:`);
        if (vri.descriptions?.short) {
          console.log(`    Description: "${vri.descriptions.short}"`);
        }
        if (vri.imageGallery) {
          console.log(`    Images: ${vri.imageGallery.length} variant-specific`);
        }
        if (vri.keyFeatures) {
          console.log(`    Features: ${vri.keyFeatures.length} variant-specific`);
        }
      });
    }

    console.log('\n✨ Rich info example complete!');

  } catch (error) {
    console.error('❌ Error in rich info example:', error.message);
  }
}

// --- Example: Consuming Semantic Relations ---

async function semanticExample() {
  console.log('🧠 Semantic relations example\n');
  try {
    // 1. Discover server vocabularies
    const capabilities = await getCapabilities();
    const vocabData = capabilities.find(c => c.id === 'dev.ocp.server.vocabularies@1.0');
    if (vocabData) {
      console.log('Server advertises the following vocabularies:');
      vocabData.metadata.forEach(vocab => {
        console.log(`  - ${vocab.prefix}: ${vocab.namespace} (${vocab.predicates?.length || 0} predicates)`);
      });
    }

    // 2. Find a product with semantic relations
    const products = await browseProducts('main');
    const productWithSemantics = products.find(
      p => p.metadata && p.metadata['dev.ocp.product.semantic_relations@1.0']
    );

    if (!productWithSemantics) {
      console.log('No products with semantic relations found.');
      return;
    }

    console.log(`\nFound semantic data for product: "${productWithSemantics.name}"`);

    // 3. Find its canonical URL (its identity)
    const links = productWithSemantics.metadata['dev.ocp.product.links@1.0'];
    const canonicalLink = links?.find(l => l.rel === 'canonical');
    const subjectURI = canonicalLink ? canonicalLink.href : `urn:ocp:product:${productWithSemantics.id}`;
    console.log(`  Subject URI (Identity): ${subjectURI}`);

    // 4. Parse and display the relations in a human-friendly way
    console.log('\nStatements (Triples):');
    const relations = productWithSemantics.metadata['dev.ocp.product.semantic_relations@1.0'];
    for (const rel of relations) {
      const predicateName = rel.predicate.split(/#|\//).pop();
      let objectDisplay = '';
      if (rel.object.type === 'uri') {
        objectDisplay = `<${rel.object.value}>`;
      } else {
        objectDisplay = `"${rel.object.value}"`;
        if (rel.object.lang) objectDisplay += `@${rel.object.lang}`;
        if (rel.object.datatype) objectDisplay += `^^<${rel.object.datatype.split('#').pop()}>`;
      }
      console.log(`  - ${predicateName}: ${objectDisplay}`);
    }

    console.log('\n✨ Semantic example complete!');

  } catch (error) {
    console.error('❌ Error in semantic example:', error.message);
  }
}

// --- Example: Working with Product Links ---

async function linksExample() {
  console.log('🔗 Product links example\n');
  try {
    const products = await browseProducts('main');

    // Find a product with links
    const productWithLinks = products.find(
      p => p.metadata && p.metadata['dev.ocp.product.links@1.0']
    );

    if (!productWithLinks) {
      console.log('No products with links found in the "main" catalog.');
      return;
    }

    console.log(`Product: "${productWithLinks.name}" (ID: ${productWithLinks.id})`);

    const links = productWithLinks.metadata['dev.ocp.product.links@1.0'];

    console.log('\nFound Links:');
    for (const link of links) {
      console.log(`  - [${link.rel}] ${link.title || link.rel}`);
      console.log(`    ${link.href}`);
      if (link.type) {
        console.log(`    Type: ${link.type}`);
      }
      if (link.hreflang) {
        console.log(`    Language: ${link.hreflang}`);
      }
    }

    console.log('\n✨ Links example complete!');

  } catch (error) {
    console.error('❌ Error in links example:', error.message);
  }
}

// --- Example: Working with Product Identifiers ---

async function identifierExample() {
  console.log('🆔 Product identifiers example\n');
  try {
    const products = await browseProducts('main');

    // Find a product with identifiers
    const productWithIds = products.find(
      p => p.metadata && p.metadata['dev.ocp.product.identifiers@1.0']
    );

    if (!productWithIds) {
      console.log('No products with identifiers found in the "main" catalog.');
      return;
    }

    console.log(`Product: "${productWithIds.name}" (ID: ${productWithIds.id})`);

    const identifiers = productWithIds.metadata['dev.ocp.product.identifiers@1.0'];
    const variants = productWithIds.metadata['dev.ocp.product.variants@1.0']?.variants;

    console.log('\nFound Identifiers:');
    for (const id of identifiers) {
      if (id.scope === 'product') {
        console.log(`  - [Product-wide] ${id.type}: ${id.value}`);
      } else if (id.scope === 'variant') {
        // Find the matching variant to give a human-friendly description
        const variant = variants?.find(v => v.id === id.variantId);
        const variantName = variant ? `(${variant.values.join('/')})` : `(Unknown Variant)`;
        console.log(`  - [Variant ${variantName}] ${id.type}: ${id.value}`);
      }
    }

    console.log('\n✨ Identifier example complete!');

  } catch (error) {
    console.error('❌ Error in identifier example:', error.message);
  }
}

// --- Example: Client-Only (Stateless) Cart Simulation ---

// For client-only carts, errors are handled locally without server persistence
function simulateClientOnlyCart() {
  console.log('🛒 Simulating client-only cart (stateless)\n');

  let localCart = {
    items: [],
    total: 0,
    currency: 'USD'
  };

  // Simulate adding item with RFC 9457-style validation
  function addItem(product, quantity = 1) {
    if (!product.available) {
      console.error('Error (400): Item Not Available');
      console.error('Detail: Item is not available');
      return false;
    }
    if (quantity < 1) {
      console.error('Error (400): Invalid Quantity');
      console.error('Detail: Quantity must be at least 1');
      return false;
    }
    if (localCart.items.length >= 10) { // Simulate max items
      console.error('Error (400): Max Items Exceeded');
      console.error('Detail: Cart has reached maximum number of items');
      return false;
    }

    localCart.items.push({ ...product, quantity });
    localCart.total += parseFloat(product.price.amount) * quantity;
    console.log(`✅ Added ${product.name} (qty: ${quantity})`);
    return true;
  }

  // Simulate checkout
  function checkout() {
    if (localCart.items.length === 0) {
      console.error('Error (400): Cart Validation Failed');
      console.error('Detail: Cart is empty');
      return false;
    }
    console.log(`📦 Checking out with total: ${localCart.total.toFixed(2)} ${localCart.currency}`);
    return true;
  }

  // Example usage
  const products = [
    { id: 'mug', name: 'Coffee Mug', price: { amount: '15.00' }, available: true },
    { id: 'guide', name: 'Guide', price: { amount: '9.99' }, available: false },
  ];

  addItem(products[0], 2);
  addItem(products[1], 1); // Should error
  addItem(products[0], -1); // Should error
  checkout();
}

// --- Export for use in other scripts ---

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ocpRequest,
    getCapabilities,
    browseProducts,
    placeOrder,
    checkOrderStatus,
    cartBasedFlow,
    variantExample,
    richInfoExample,
    semanticExample,
    linksExample,
    identifierExample,
    revisionExample,
    subscribeToOrderUpdates,
    simulateClientOnlyCart,
  };
}

// --- Run examples ---

// Uncomment to run:
// main();
// cartBasedFlow();
// variantExample();
// richInfoExample();
// semanticExample();
// linksExample();
// identifierExample();
// revisionExample();

// Example: Subscribe to order updates
// const eventSource = subscribeToOrderUpdates('order_123');
// setTimeout(() => eventSource.close(), 30000); // Stop after 30 seconds
