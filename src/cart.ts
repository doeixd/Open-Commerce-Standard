// OCP Cart Management Endpoints Implementation

import { Hono } from 'hono';
import type { CreateCartRequest, CartItemRequest, UpdateCartItemRequest, PromotionRequest } from './types';
import { OCP_ERRORS, validateRequired, validateString, validateMin } from './errors';

// Cart routes
export function createCartRoutes() {
  const cart = new Hono();

  // POST /carts - Create a new cart
  cart.post('/carts', async (c) => {
    const { cartStorage, config, userId } = c.var.ocp;

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const body: CreateCartRequest = await c.req.json();

    // Validate request
    const errors = [];
    const storeIdError = validateString(body.storeId, 'storeId', { minLength: 1, maxLength: 100 });
    if (storeIdError) errors.push(storeIdError);

    if (errors.length > 0) {
      throw OCP_ERRORS.VALIDATION_ERROR(errors);
    }

    // Check if store exists
    const store = config.stores?.find(s => s.id === body.storeId);
    if (!store) {
      throw OCP_ERRORS.STORE_NOT_FOUND;
    }

    // Create cart
    const newCart = await cartStorage.create({
      items: [],
      subtotal: { amount: '0.00', currency: 'USD' },
      tax: { amount: '0.00', currency: 'USD' },
      total: { amount: '0.00', currency: 'USD' },
    });

    return c.json(newCart, {
      status: 201,
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // GET /carts/{cartId} - Get a cart by ID
  cart.get('/carts/:cartId', async (c) => {
    const { cartStorage, userId } = c.var.ocp;
    const cartId = c.req.param('cartId');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const cartIdError = validateString(cartId, 'cartId', { minLength: 1, maxLength: 100 });
    if (cartIdError) {
      throw OCP_ERRORS.VALIDATION_ERROR([cartIdError]);
    }

    const cart = await cartStorage.get(cartId);
    if (!cart) {
      throw OCP_ERRORS.CART_NOT_FOUND;
    }

    return c.json(cart, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // POST /carts/{cartId}/items - Add item to cart
  cart.post('/carts/:cartId/items', async (c) => {
    const { cartStorage, config, userId } = c.var.ocp;
    const cartId = c.req.param('cartId');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const body: CartItemRequest = await c.req.json();

    // Validate request
    const errors = [];
    const itemIdError = validateRequired(body.itemId, 'itemId');
    if (itemIdError) errors.push(itemIdError);

    const quantityError = validateMin(body.quantity, 1, 'quantity');
    if (quantityError) errors.push(quantityError);

    if (errors.length > 0) {
      throw OCP_ERRORS.VALIDATION_ERROR(errors);
    }

    // Get cart
    const cart = await cartStorage.get(cartId);
    if (!cart) {
      throw OCP_ERRORS.CART_NOT_FOUND;
    }

    // Find item in catalogs
    let catalogItem;
    if (config.catalogs) {
      for (const catalog of config.catalogs) {
        catalogItem = catalog.items.find(item => item.id === body.itemId);
        if (catalogItem) break;
      }
    }

    if (!catalogItem) {
      throw OCP_ERRORS.VALIDATION_ERROR([{
        type: 'validation',
        field: 'itemId',
        value: body.itemId,
        reason: 'Item not found in any catalog'
      }]);
    }

    // Check stock (simplified - in real implementation, check inventory)
    if (!catalogItem.available) {
      throw OCP_ERRORS.INSUFFICIENT_STOCK(body.itemId);
    }

    // Add item to cart
    const cartItemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newItem = {
      ...body,
      cartItemId,
      price: catalogItem.price,
    };

    // Calculate totals
    const allItems = [...cart.items, newItem];
    const subtotalAmount = allItems.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);

    const updatedCart = await cartStorage.update(cartId, {
      items: allItems,
      subtotal: { amount: subtotalAmount.toFixed(2), currency: 'USD' },
      tax: { amount: '0.00', currency: 'USD' },
      total: { amount: subtotalAmount.toFixed(2), currency: 'USD' },
    });

    if (!updatedCart) {
      throw OCP_ERRORS.INTERNAL_SERVER_ERROR;
    }

    return c.json(updatedCart, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // PATCH /carts/{cartId}/items/{itemId} - Update cart item
  cart.patch('/carts/:cartId/items/:itemId', async (c) => {
    const { cartStorage, userId } = c.var.ocp;
    const cartId = c.req.param('cartId');
    const itemId = c.req.param('itemId');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const body: UpdateCartItemRequest = await c.req.json();

    // Validate quantity if provided
    if (body.quantity !== undefined) {
      const quantityError = validateMin(body.quantity, 1, 'quantity');
      if (quantityError) {
        throw OCP_ERRORS.VALIDATION_ERROR([quantityError]);
      }
    }

    // Get cart
    const cart = await cartStorage.get(cartId);
    if (!cart) {
      throw OCP_ERRORS.CART_NOT_FOUND;
    }

    // Find and update item
    const itemIndex = cart.items.findIndex(item => item.cartItemId === itemId);
    if (itemIndex === -1) {
      throw OCP_ERRORS.VALIDATION_ERROR([{
        type: 'validation',
        field: 'itemId',
        reason: 'Item not found in cart'
      }]);
    }

    const updatedItems = [...cart.items];
    const updateData = { ...body };
    // Handle null notes by removing the field
    if (updateData.notes === null) {
      delete updateData.notes;
    }
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updateData } as typeof updatedItems[0];

    const updatedCart = await cartStorage.update(cartId, {
      items: updatedItems,
      // In real implementation, recalculate totals
    });

    if (!updatedCart) {
      throw OCP_ERRORS.INTERNAL_SERVER_ERROR;
    }

    return c.json(updatedCart, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // DELETE /carts/{cartId}/items/{itemId} - Remove item from cart
  cart.delete('/carts/:cartId/items/:itemId', async (c) => {
    const { cartStorage, userId } = c.var.ocp;
    const cartId = c.req.param('cartId');
    const itemId = c.req.param('itemId');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    // Get cart
    const cart = await cartStorage.get(cartId);
    if (!cart) {
      throw OCP_ERRORS.CART_NOT_FOUND;
    }

    // Remove item
    const updatedItems = cart.items.filter(item => item.cartItemId !== itemId);

    const updatedCart = await cartStorage.update(cartId, {
      items: updatedItems,
      // In real implementation, recalculate totals
      subtotal: { amount: '0.00', currency: 'USD' },
      tax: { amount: '0.00', currency: 'USD' },
      total: { amount: '0.00', currency: 'USD' },
    });

    if (!updatedCart) {
      throw OCP_ERRORS.INTERNAL_SERVER_ERROR;
    }

    return c.json(updatedCart, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // POST /carts/{cartId}/promotions - Apply promotion to cart
  cart.post('/carts/:cartId/promotions', async (c) => {
    const { cartStorage, userId } = c.var.ocp;
    const cartId = c.req.param('cartId');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const body: PromotionRequest = await c.req.json();

    // Validate request
    const errors = [];
    const typeError = validateRequired(body.type, 'type');
    if (typeError) errors.push(typeError);

    const valueError = validateRequired(body.value, 'value');
    if (valueError) errors.push(valueError);

    if (errors.length > 0) {
      throw OCP_ERRORS.VALIDATION_ERROR(errors);
    }

    // Get cart
    const cart = await cartStorage.get(cartId);
    if (!cart) {
      throw OCP_ERRORS.CART_NOT_FOUND;
    }

    // Simple promotion validation (in real implementation, check against promotion service)
    if (body.value !== 'SUMMER10') {
      throw OCP_ERRORS.INVALID_PROMOTION;
    }

    // Apply promotion (simplified)
    const updatedCart = await cartStorage.update(cartId, {
      // In real implementation, apply discount to totals
      subtotal: { amount: '9.00', currency: 'USD' },
      tax: { amount: '0.72', currency: 'USD' },
      total: { amount: '9.72', currency: 'USD' },
    });

    if (!updatedCart) {
      throw OCP_ERRORS.INTERNAL_SERVER_ERROR;
    }

    return c.json(updatedCart, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  return cart;
}