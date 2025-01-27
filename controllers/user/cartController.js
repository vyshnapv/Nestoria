const env=require("dotenv").config();
const User = require("../../models/userModel");
const Category = require("../../models/categoryModel");
const Product = require("../../models/productModel");
const Cart = require("../../models/cartModel");
const Address = require("../../models/addressModel");
const Offer=require("../../models/offerModel")
const fs = require("fs");
const path = require("path")

//load cart page 
const loadCart = async (req, res) => {
    try {
        const userData = await User.findById(req.session.user);
        const cart = await Cart.findOne({ userId: req.session.user }).populate({
            path: 'items.product',
            populate: {
                path: 'category',
                model: 'Category'
            }
        }) || { items: [] };
        
        const currentDate = new Date();
        const offers = await Offer.find({
            status: 'Active',
            expireDate: { $gt: currentDate }
        });

        const processedItems = cart.items.map(item => {
            const productOffer = offers.find(offer => 
                (offer.productIds?.includes(item.product._id)) ||
                (offer.categoryIds?.includes(item.product.category._id))
            );

            const highestDiscount = productOffer ? productOffer.discount : 0;
            const offerPrice = productOffer 
                ? item.product.regularPrice * (1 - productOffer.discount / 100)
                : item.product.regularPrice;

            return {
                ...item.toObject(),
                product: {
                    ...item.product.toObject(),
                    highestDiscount,
                    offerPrice
                }
            };
        });

        let subtotal = 0;
        if (processedItems) {
            subtotal = processedItems.reduce((total, item) => {
                return total + (item.product.offerPrice * item.quantity); 
            }, 0);
        }

        res.render('cart', { 
            userData, 
            cart: { items: processedItems },
            subtotal 
        });

    } catch (error) {
        console.error("Error loading cart page", error);
        res.redirect("/pageNotFound");
    }
};
//add to cart
const addToCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.body.productId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to add items to your cart.", requireLogin: true });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        if (product.quantity <= 0) {
            return res.status(400).json({ success: false, message: "Product is out of stock." });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const existingItemIndex = cart.items.findIndex(item => item.product.toString() === productId);

        if (existingItemIndex > -1) {
            return res.status(200).json({ success: true, message: "Product already added to cart!", cartCount: cart.items.length });
        } else {
            cart.items.push({ product: productId, quantity: 1 });
        }

        await cart.save();
        return res.status(200).json({ success: true, message: "Product added to cart successfully!", cartCount: cart.items.length });

    } catch (error) {
        console.error("Error adding product to cart:", error);
        res.status(500).json({ success: false, message: "An error occurred while adding the product to the cart." });
    }
};


//updatecartquantity
const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId, quantity } = req.body;

        const cart = await Cart.findOne({ userId });
        const product = await Product.findById(productId);

        if (!cart || !product) {
            return res.status(404).json({ success: false, message: cart ? "Product not found." : "Cart not found." });
        }

        const item = cart.items.find(item => item.product.toString() === productId);
        if (!item) {
            return res.status(404).json({success: false, message: "Product not found in cart." });
        }

        if (quantity < 1) {
            return res.status(400).json({success: false,message: "Quantity must be at least 1."});
        }

        if (quantity > product.quantity) {
            return res.status(400).json({success: false, message: `Only ${product.quantity} item(s) available in stock.`,availableStock: product.quantity});
        }

        item.quantity = quantity;
        await cart.save();

        const subtotal = cart.items.reduce((total, i) => {
            const productPrice = i.product.regularPrice; 
            return total + (productPrice * i.quantity);
        }, 0);

        res.status(200).json({success: true,subtotal,itemTotal: product.regularPrice * quantity });

    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(500).json({success: false,message: "An error occurred while updating the quantity."});
    }
};


//remove cart items
const removeCartItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.body.productId;

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found." });
        }

        cart.items = cart.items.filter(item => item.product.toString() !== productId);
        await cart.save();

        const subtotal = cart.items.reduce((total, item) => total + (item.product.regularPrice * item.quantity), 0);
        res.status(200).json({ success: true, subtotal });

    } catch (error) {
        console.error("Error removing item from cart:", error);
        res.status(500).json({ success: false, message: "An error occurred while removing the item from the cart." });
    }
};


//checkout page 
const loadCheckout = async (req, res) => {
    try {
      const userData = await User.findById(req.session.user);
      const cart = await Cart.findOne({ userId: req.session.user })
        .populate({
          path: 'items.product',
          populate: {
            path: 'category',
            model: 'Category'
          }
        }) || { items: [] };
  
      const currentDate = new Date();
      const offers = await Offer.find({
        status: 'Active',
        expireDate: { $gt: currentDate }
      });

      const processedItems = cart.items.map(item => {
        const productOffer = offers.find(offer => 
            (offer.productIds?.includes(item.product._id)) ||
            (offer.categoryIds?.includes(item.product.category._id))
        );

        const highestDiscount = productOffer ? productOffer.discount : 0;
        const offerPrice = productOffer 
            ? item.product.regularPrice * (1 - productOffer.discount / 100)
            : item.product.regularPrice;

        return {
            ...item.toObject(),
            product: {
                ...item.product.toObject(),
                highestDiscount,
                offerPrice
            }
        };
      });

      let subtotal = 0;
      if (processedItems) {
        subtotal = processedItems.reduce((total, item) => {
            return total + (item.product.offerPrice * item.quantity); 
        }, 0);
      }
  
      const addresses = await Address.findOne({ userId: req.session.user }) || { address: [] };
  
      res.render("checkout", {
        userData,
        cart: { items: processedItems },
        subtotal,
        addresses
      });
  
    } catch (error) {
      console.error("Error loading checkout page:", error);
      res.redirect("/cart");
    }
  };


//addcheck address
  const addCheckAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login to add address"
            });
        }

       
        const { name, phone, district, city, house, state, pincode } = req.body;
        
        let userAddress = await Address.findOne({ userId });
        
        if (!userAddress) {
            userAddress = new Address({
                userId,
                address: []
            });
        }

        
        userAddress.address.push({
            name,
            phone,
            district,
            city,
            house,
            state,
            pincode
        });

        await userAddress.save();

       
        return res.json({success: true, message: 'Address added successfully',addresses: userAddress});

    } catch (error) {
        console.error("Error adding address:", error);
        return res.status(500).json({ success: false, message: 'Failed to add address'});
    }
};

 module.exports={
        loadCart,
        addToCart,
        updateCartQuantity,
        removeCartItem,
        loadCheckout,
        addCheckAddress,
    }
