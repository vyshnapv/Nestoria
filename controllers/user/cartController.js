const env=require("dotenv").config();
const User = require("../../models/userModel");
const Category = require("../../models/categoryModel");
const Product = require("../../models/productModel");
const Cart = require("../../models/cartModel");
const Address = require("../../models/addressModel");
const Offer=require("../../models/offerModel")
const Coupon=require("../../models/couponModel")
const Wallet=require("../../models/walletModel")
const fs = require("fs");
const path = require("path")

const roundToTwo = (num) => {
    return Math.round(num * 100) / 100;
};

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
            if (!item.product) {
                return null; 
            }
            
            const productWithDefaults = {
                ...item.product.toObject(),
                productImage: item.product.productImage || ['default-product.jpg']
            };
            
            if (!item.product.category) {
                return {
                    ...item.toObject(),
                    product: {
                        ...productWithDefaults,
                        highestDiscount: 0,
                        offerPrice: item.product.regularPrice || 0
                    }
                };
            }
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
        }).filter(item => item !== null);

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
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const userData = await User.findById(req.session.user);
        if (!userData) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId: req.session.user })
            .populate({
                path: 'items.product',
                populate: {
                    path: 'category',
                    model: 'Category'
                }
            });

            if (!cart || !cart.items || cart.items.length === 0) {
                delete req.session.appliedCoupon;
                return res.redirect('/cart');
            }

        const currentDate = new Date();
        const offers = await Offer.find({
            status: 'Active',
            expireDate: { $gt: currentDate }
        });

        const processedItems = cart.items
            .filter(item => item.product && item.product.category) 
            .map(item => {
                const productOffer = offers.find(offer => 
                    (offer.productIds && offer.productIds.includes(item.product._id)) ||
                    (offer.categoryIds && offer.categoryIds.includes(item.product.category._id))
                );

                const highestDiscount = productOffer ? productOffer.discount : 0;
                const regularPrice = item.product.regularPrice || 0;
                const offerPrice = productOffer 
                    ? regularPrice * (1 - productOffer.discount / 100)
                    : regularPrice;

                return {
                    ...item.toObject(),
                    product: {
                        ...item.product.toObject(),
                        highestDiscount,
                        offerPrice: roundToTwo(offerPrice)
                    }
                };
            });

            let subtotal = roundToTwo(processedItems.reduce((total, item) => {
                const price = item.product.offerPrice || item.product.regularPrice || 0;
                return total + (price * (item.quantity || 1));
            }, 0));

            const appliedCoupon = req.session.appliedCoupon;
            let finalAmount = subtotal;
            let itemsWithDiscount = processedItems;
    
            if (appliedCoupon) {
                const totalDiscount = roundToTwo(appliedCoupon.discountAmount || 0);
                itemsWithDiscount = processedItems.map(item => {
                    const itemTotal = roundToTwo((item.product.offerPrice || 0) * (item.quantity || 1));
                    const itemProportion = subtotal > 0 ? itemTotal / subtotal : 0;
                    const itemDiscount = roundToTwo(totalDiscount * itemProportion);
                    const finalItemPrice = roundToTwo(itemTotal - itemDiscount);
                    
                    return {
                        ...item,
                        couponDiscount: {
                            amount: itemDiscount,
                            priceBeforeDiscount: itemTotal,
                            finalPrice: finalItemPrice,
                            perUnitDiscount: item.quantity > 0 ? roundToTwo(itemDiscount / item.quantity) : 0
                        }
                    };
                });
                finalAmount = roundToTwo(subtotal - (appliedCoupon.discountAmount || 0));
            }

            const addresses = await Address.findOne({ userId: req.session.user }) || { address: [] };
        
            const coupons = await Coupon.find({ 
                status: 'Active', 
                expiryDate: { $gt: currentDate },
                redeemedUsers: { $ne: req.session.user } 
            });
    
            const wallet = await Wallet.findOne({ userId: req.session.user });
            const walletBalance = wallet ? wallet.balance : 0;

            res.render("checkout", {
                userData,
                cart: { items: itemsWithDiscount },
                subtotal,
                finalAmount,
                appliedCoupon,
                addresses,
                coupons,
                walletBalance
            });
    
    } catch (error) {
        console.error("Error loading checkout page:", error);
        res.status(500).redirect("/cart");
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

// Apply Coupon
const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user;

        if (req.session.appliedCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Please remove the currently applied coupon first'
            });
        }

        const coupon = await Coupon.findOne({ 
            couponCode, 
            status: 'Active',
            expiryDate: { $gt: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired coupon'
            });
        }
        
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.product',
                populate: {
                    path: 'category',
                    model: 'Category'
                }
            });

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

        const currentDate = new Date();
        const offers = await Offer.find({
            status: 'Active',
            expireDate: { $gt: currentDate }
        });

        let subtotal = cart.items.reduce((total, item) => {
            if (!item.product || !item.quantity) {
                return total;
            }
            const productOffer = offers.find(offer => {
                return (offer.productIds?.includes(item.product._id)) ||
                    (item.product.category && offer.categoryIds?.includes(item.product.category._id));
            });
            
            const price = productOffer 
                ? item.product.regularPrice * (1 - productOffer.discount / 100)
                : item.product.regularPrice;
                
            return total + (price * item.quantity);
        }, 0);

        subtotal = Math.round(subtotal * 100) / 100;

        if (subtotal < coupon.minPrice) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minPrice} required`
            });
        }

        const percentageDiscount = (subtotal * coupon.percentage) / 100;

        let finalDiscountAmount;
        if (percentageDiscount > coupon.maxRedeemAmount) {
            finalDiscountAmount = coupon.maxRedeemAmount;
        } else {
            finalDiscountAmount = percentageDiscount;
        }

        finalDiscountAmount = Math.round(finalDiscountAmount * 100) / 100;
        
        req.session.appliedCoupon = {
            code: couponCode,
            discountAmount: finalDiscountAmount,
            percentage: coupon.percentage,
            originalAmount: subtotal,
            maxRedeemAmount: coupon.maxRedeemAmount,
            appliedDiscount: finalDiscountAmount === coupon.maxRedeemAmount ? 
                'Maximum discount applied' : 'Percentage discount applied'
        };

        const finalAmount = subtotal - finalDiscountAmount;

        return res.json({
            success: true,
            message: `Coupon applied successfully! ${finalDiscountAmount === coupon.maxRedeemAmount ? 
                'Maximum discount of ₹' + finalDiscountAmount + ' applied.' : 
                coupon.percentage + '% discount of ₹' + finalDiscountAmount + ' applied.'}`,
            discountAmount: finalDiscountAmount,
            finalAmount: finalAmount,
            discountType: finalDiscountAmount === coupon.maxRedeemAmount ? 
                'Maximum discount' : 'Percentage discount'
        });

    } catch (error) {
        console.error("Error applying coupon:", error);
        return res.status(500).json({
            success: false,
            message: 'Failed to apply coupon'
        });
    }
};

// Remove Coupon
const removeCoupon = async (req, res) => {
    try {
        delete req.session.appliedCoupon;
        
        return res.json({
            success: true,
            message: 'Coupon removed successfully'
        });
    } catch (error) {
        console.error("Error removing coupon:", error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove coupon'
        });
    }
};

 module.exports={
        loadCart,
        addToCart,
        updateCartQuantity,
        removeCartItem,
        loadCheckout,
        addCheckAddress,
        applyCoupon,
        removeCoupon
    }
