const mongoose = require('mongoose');
const User = require("../../models/userModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const Order = require("../../models/orderModel");
const Product = require("../../models/productModel");
const Offer=require("../../models/offerModel")
const Category = require("../../models/categoryModel");
const Coupon=require("../../models/couponModel")
const Wallet=require("../../models/walletModel")
const {addToWallet}=require("../../controllers/user/walletController")
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

//get create order 
const createOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { paymentMethod, addressId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to place an order." });
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.product',
            populate: {
                path: 'category',
                model: 'Category'
            }
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty." });
        }

        for (const item of cart.items) {
            if (!item.product || !item.product._id) {
                cart.items = cart.items.filter(cartItem => cartItem.product && cartItem.product._id);
                await cart.save();
                return res.status(400).json({ 
                    success: false, 
                    message: "Some products in your cart are no longer available. Cart has been updated." 
                });
            }
            const product = await Product.findById(item.product._id);
            if (!product) {
                cart.items = cart.items.filter(cartItem => cartItem.product._id.toString() !== item.product._id.toString());
                await cart.save();
                return res.status(400).json({ 
                    success: false, 
                    message: "Some products in your cart are no longer available. Cart has been updated." 
                });
            }

            if (product.quantity < item.quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient stock for ${product.productName}. Only ${product.quantity} available.` 
                });
            }
        }

        const address = await Address.findOne({ userId });
        if (!address || !address.address[addressId]) {
            return res.status(404).json({ success: false, message: "Address not found." });
        }

        const selectedAddress = address.address[addressId];

        const orderItems = [];
        let subtotal = 0;
        
        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            const originalPrice = product.regularPrice;
            
            const currentDate = new Date();
            const offers = await Offer.find({
                status: 'Active',
                expireDate: { $gt: currentDate }
            });
            
            const productOffer = offers.find(offer => 
                (offer.productIds?.includes(product._id)) ||
                (offer.categoryIds?.includes(product.category))
            );

            const priceAfterOffer = productOffer 
                ? originalPrice * (1 - productOffer.discount / 100)
                : originalPrice;
            
            const itemSubtotal = priceAfterOffer * item.quantity;
            subtotal += itemSubtotal;

            orderItems.push({
                productId: product._id,
                productName: product.productName,
                quantity: item.quantity,
                price: originalPrice,
                finalPrice: itemSubtotal,
                itemStatus: "Ordered",
                highestDiscount: productOffer ? productOffer.discount : 0
            });
        }

        let finalAmount = subtotal;
        const appliedCoupon = req.session.appliedCoupon;
        
        if (appliedCoupon) {
            const discountAmount = appliedCoupon.discountAmount;
            finalAmount = subtotal - discountAmount;

            orderItems.forEach(item => {
                const proportion = item.finalPrice / subtotal;
                const itemDiscount = discountAmount * proportion;
                item.finalPrice -= itemDiscount;
            });
        }

        finalAmount+=50;
        if (paymentMethod === 'COD' && finalAmount > 1000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cash on Delivery is not available for orders above ₹1,000' 
            });
        }

        switch (paymentMethod) {
            case 'COD': {
                const newOrder = new Order({
                    orderId: `ORD-${Date.now()}`,
                    userId,
                    items: orderItems,
                    totalPrice: finalAmount,
                    deliveryCharge: 50,
                    address: {
                        name: selectedAddress.name,
                        phone: selectedAddress.phone,
                        district: selectedAddress.district,
                        city: selectedAddress.city,
                        house: selectedAddress.house,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                    },
                    paymentMethod,
                    paymentStatus: 'Pending',
                    orderStatus: "Processing"
                });

                await newOrder.save();

                if (appliedCoupon) {
                    await Coupon.findOneAndUpdate(
                        { couponCode: appliedCoupon.code },
                        { $addToSet: { redeemedUsers: userId } }
                    );
                }

                for (const item of orderItems) {
                    await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { quantity: -item.quantity } }
                    );
                }

                await Cart.deleteOne({ userId });
                delete req.session.appliedCoupon;

                return res.status(200).json({ 
                    success: true, 
                    orderId: newOrder.orderId 
                });
            }

            case 'Wallet': {
                const wallet = await Wallet.findOne({ userId });
                
                if (!wallet || wallet.balance < finalAmount) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Insufficient wallet balance' 
                    });
                }

                const newOrder = new Order({
                    orderId: `ORD-${Date.now()}`,
                    userId,
                    items: orderItems,
                    totalPrice: finalAmount,
                    address: {
                        name: selectedAddress.name,
                        phone: selectedAddress.phone,
                        district: selectedAddress.district,
                        city: selectedAddress.city,
                        house: selectedAddress.house,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                    },
                    paymentMethod,
                    paymentStatus: 'Paid',
                    orderStatus: "Processing"
                });

                await newOrder.save();

                if (appliedCoupon) {
                    await Coupon.findOneAndUpdate(
                        { couponCode: appliedCoupon.code },
                        { $addToSet: { redeemedUsers: userId } }
                    );
                }

                for (const item of orderItems) {
                    await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { quantity: -item.quantity } }
                    );
                }

                wallet.balance -= finalAmount;
                wallet.transactions.push({
                    amount: finalAmount,
                    type: 'debit',
                    description: `Payment for order ${newOrder.orderId}`,
                    balance: wallet.balance
                });
                await wallet.save();

                await Cart.deleteOne({ userId });
                delete req.session.appliedCoupon;

                return res.status(200).json({ 
                    success: true, 
                    orderId: newOrder.orderId 
                });
            }

            case 'Razorpay': {
                const razorpayOrderOptions = {
                    amount: Math.round(finalAmount * 100),
                    currency: 'INR',
                    receipt: `ORD-${Date.now()}`,
                    payment_capture: 1
                };

                const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);

                const newOrder = new Order({
                    orderId: `ORD-${Date.now()}`,
                    userId,
                    items: orderItems,
                    totalPrice: finalAmount,
                    address: {
                        name: selectedAddress.name,
                        phone: selectedAddress.phone,
                        district: selectedAddress.district,
                        city: selectedAddress.city,
                        house: selectedAddress.house,
                        state: selectedAddress.state,
                        pincode: selectedAddress.pincode,
                    },
                    paymentMethod,
                    paymentStatus: 'Pending',
                    orderStatus: "Processing",
                    razorpayOrderId: razorpayOrder.id
                });

                await newOrder.save();

                if (appliedCoupon) {
                    await Coupon.findOneAndUpdate(
                        { couponCode: appliedCoupon.code },
                        { $addToSet: { redeemedUsers: userId } }
                    );
                }

                await Cart.deleteOne({ userId });
                delete req.session.appliedCoupon;

                return res.status(200).json({ 
                    success: true, 
                    orderId: newOrder.orderId,
                    razorpayOrder: {
                        id: razorpayOrder.id,
                        key: process.env.RAZORPAY_KEY_ID,
                        amount: razorpayOrder.amount
                    }
                });
            }

            default:
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid payment method' 
                });
        }

    } catch (error) {
        console.error("Error placing order:", error);
        return res.status(500).json({ 
            success: false, 
            message: error.message || 'An error occurred while placing the order' 
        });
    }
};

//razorpay
const verifyRazorpayPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            status 
        } = req.body;

        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
        
        if (!order) {
            console.error('Order not found for Razorpay order ID:', razorpay_order_id);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

         if (status === 'failed') {
            order.paymentStatus = 'Failed';
            order.orderStatus = 'pending';
            await order.save();
            return res.status(200).json({ 
                success: false, 
                message: 'Payment failed',
                orderId: order.orderId 
            });
        }

        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            order.paymentStatus = 'Failed';
            order.orderStatus = 'pending';
            await order.save();
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        for (const item of order.items) {
            await Product.findByIdAndUpdate(
                item.productId,
                { $inc: { quantity: -item.quantity } }
            );
        }

        order.paymentStatus = 'Paid';
        order.paymentMethod = 'Razorpay';
        order.razorpayPaymentId = razorpay_payment_id;
        
        await order.save();

        return res.status(200).json({ 
            success: true, 
            message: 'Payment verified successfully',
            orderId: order.orderId
        });

    } catch (error) {
        console.error('Razorpay verification error:', error);
        try {
            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
            if (order) {
                order.paymentStatus = 'Failed';
                order.orderStatus = 'Cancelled';
                await order.save();
            }
        } catch (err) {
            console.error('Error updating order status:', err);
        }
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};

const createRazorpayOrder = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: orderId,
        });
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            orderId: razorpayOrder.id
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order'
        });
    }
};

//ordersuccess
const orderSuccess = async (req,res)=>{
  try {

    const userData = req.session.user ? await User.findById(req.session.user) : null;
    
    const { orderId } = req.params;
    
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    await order.save();

    const user = await User.findById(order.userId);

    if (!user.orderHistory) {
      user.orderHistory = [];
    }

    user.orderHistory.push(order._id);
    await user.save();


    res.render('orderPlaced', {
      userData,
      order,
      user,
    });

  } catch (error) {
    console.error('Error in orderSuccess:', error);
    res.status(500).json({ success: false, message: 'An error occurred while processing the order' });
    
  }
}

//get view order page 
const getViewOrders = async (req, res) => {
    try {
        const userData = await User.findById(req.session.user);
        if (!userData) {
            return res.redirect('/login');
        }
    
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search ? req.query.search.trim() : '';
        
        let searchConditions = { userId: userData._id };
    
        if (searchQuery) {
            searchConditions = {
                userId: userData._id,
                $or: [
                    { orderId: { $regex: new RegExp(searchQuery, 'i') } },
                    { orderStatus: { $regex: new RegExp(searchQuery, 'i') } },
                    { paymentStatus: { $regex: new RegExp(searchQuery, 'i') } }
                ]
            };
        }

        const orders = await Order.find(searchConditions)
            .populate({
                path: 'items.productId',
                populate: {
                    path: 'category',
                    model: 'Category'
                }
            })
            .sort({ createdAt: -1 })
            .lean();

        const totalOrdersCount = orders.length;
        const totalPages = Math.ceil(totalOrdersCount / limit);
        const paginatedOrders = orders.slice(skip, skip + limit);

        if (!paginatedOrders || paginatedOrders.length === 0) {
            return res.render("viewOrders", {
                userData,
                orders: [],
                paginatedOrders: [],
                currentPage: 1,
                totalPages: 1,
                searchQuery,
                helpers: {
                    getStatusClass: (status) => {
                        switch (status.toLowerCase()) {
                            case 'paid': return 'paid';
                            case 'pending': return 'pending';
                            case 'failed': return 'failed';
                            case 'processing': return 'processing';
                            case 'shipped': return 'shipped';
                            case 'delivered': return 'delivered';
                            default: return '';
                        }
                    }
                }
            });
        }

        const formattedOrders = paginatedOrders.map(order => {
            const totalWithoutDelivery = order.items.reduce((total, item) => {
                return total + item.finalPrice;
            }, 0);
  
            let finalTotal = totalWithoutDelivery;
            if (order.appliedCoupon) {
                finalTotal = totalWithoutDelivery - order.appliedCoupon.discountAmount;
            }
  
            finalTotal += 50;
  
            return {
                orderId: order.orderId,
                date: new Date(order.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }),
                totalPrice: finalTotal.toFixed(2),
                originalTotal: order.totalPrice,
                deliveryCharge: 50,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus,
                paymentMethod: order.paymentMethod,
                items: order.items.map(item => ({
                    ...item,
                    originalPrice: item.price,
                    finalPrice: item.finalPrice
                })),
                appliedCoupon: order.appliedCoupon
            };
        });
  
        res.render("viewOrders", {
            userData,
            orders: formattedOrders,
            paginatedOrders: formattedOrders,
            currentPage: page,
            totalPages,
            searchQuery,
            helpers: {
                getStatusClass: (status) => {
                    switch (status.toLowerCase()) {
                        case 'paid': return 'paid';
                        case 'pending': return 'pending';
                        case 'failed': return 'failed';
                        case 'processing': return 'processing';
                        case 'shipped': return 'shipped';
                        case 'delivered': return 'delivered';
                        default: return '';
                    }
                }
            }
        });
  
    } catch (error) {
        console.error('Error in getViewOrders:', error);
        res.render("viewOrders", {
            userData: req.session.user ? await User.findById(req.session.user) : null,
            orders: [],
            paginatedOrders: [],
            currentPage: 1,
            totalPages: 1,
            searchQuery: '',
            error: "An error occurred while fetching your orders. Please try again later.",
            helpers: {
                getStatusClass: (status) => {
                    switch (status.toLowerCase()) {
                        case 'paid': return 'paid';
                        case 'pending': return 'pending';
                        case 'failed': return 'failed';
                        case 'processing': return 'processing';
                        case 'shipped': return 'shipped';
                        case 'delivered': return 'delivered';
                        default: return '';
                    }
                }
            }
        });
    }
};

//get order details
const getOrderDetails = async (req, res) => {
    try {
        const userData = await User.findById(req.session.user);
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: {
                path: 'category',
                model: 'Category',
                select: 'name'
            }
        });

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found',
                error: { status: 404 }
            });
        }
        const currentDate = new Date();
        const offers = await Offer.find({
            status: 'Active',
            expireDate: { $gt: currentDate }
        });

        let activeSubtotal = 0;
        let activeItemsCount = 0;

        const processedItems = order.items.map(item => {

            const productOffer = offers.find(offer => 
                (offer.productIds?.includes(item.productId._id)) ||
                (offer.categoryIds?.includes(item.productId.category._id))
            );

            const highestDiscount = productOffer ? productOffer.discount : 0;
            const offerPrice = item.offerPrice || (productOffer 
                ? item.price * (1 - productOffer.discount / 100)
                : item.price);

            const itemData = {
                productName: item.productName,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                highestDiscount: highestDiscount,
                offerPrice: offerPrice,
                finalPrice: item.finalPrice,
                itemStatus: item.itemStatus,
                returnStatus: item.returnStatus || 'Not Requested',
                returnReason: item.returnReason || '',
                category: item.productId.category
            };

            if (item.itemStatus !== 'Cancelled') {
                activeSubtotal += item.finalPrice;
                activeItemsCount++;
            }

            return itemData;
        });

        let finalTotal = activeSubtotal;
        if (order.appliedCoupon && activeItemsCount > 0) {
            const proportionalDiscount = (activeSubtotal / order.totalPrice) * order.appliedCoupon.discountAmount;
            finalTotal = activeSubtotal - proportionalDiscount;
        }
        finalTotal += 50;
        const formattedOrder = {
            orderId: order.orderId,
            orderDate: new Date(order.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            address: order.address,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            items: processedItems.map(item => ({
                productName: item.productName,
                category: item.category,
                image: item.productId.productImage[0],
                quantity: item.quantity,
                price: item.price,
                offerPrice: item.offerPrice,
                highestDiscount: item.highestDiscount,
                finalPrice: item.finalPrice,
                itemStatus: item.itemStatus,
                returnStatus: item.returnStatus
            })),
            totalPrice: order.totalPrice,
            subtotal: activeSubtotal,
            deliveryCharge: 50,
            appliedCoupon: order.appliedCoupon ? {
                code: order.appliedCoupon.code,
                discountAmount: order.appliedCoupon.discountAmount
            } : null
        };

        res.render("orderDetails", {
            userData,
            order: formattedOrder
        });

    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        res.status(500).render('error', {
            message: 'An error occurred while fetching order details',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};


//cancelled order
const cancelOrderItem = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { productName, reason } = req.body;
        
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const itemIndex = order.items.findIndex(item => item.productName === productName);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        const item = order.items[itemIndex];
        if (item.itemStatus !== 'Ordered' && item.itemStatus !== 'Processing') {
            return res.status(400).json({ 
                success: false, 
                message: 'This item cannot be cancelled in its current status' 
            });
        }

        let refundAmount = item.finalPrice;
        if (order.appliedCoupon) {
            const proportionalDiscount = (item.finalPrice / order.totalPrice) * order.appliedCoupon.discountAmount;
            refundAmount = item.finalPrice - proportionalDiscount;
        }

        const activeItems = order.items.filter((i, idx) => idx !== itemIndex && i.itemStatus !== 'Cancelled');
        if (activeItems.length === 0) {
            refundAmount += 50; 
        }

        if ((order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') && 
            order.paymentStatus === 'Paid') {
            let wallet = await Wallet.findOne({ userId: order.userId });
            
            if (!wallet) {
                wallet = new Wallet({
                    userId: order.userId,
                    balance: 0,
                    transactions: []
                });
            }

            const newBalance = wallet.balance + refundAmount;
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                description: `Refund for cancelled item: ${item.productName}`,
                orderId: order._id,
                balance: newBalance
            });

            wallet.balance = newBalance;
            await wallet.save();
        }

        item.itemStatus = 'Cancelled';
        item.reason = reason;

        const product = await Product.findById(item.productId);
        if (product) {
            product.quantity += item.quantity;
            await product.save();
        }

        const remainingActiveItems = order.items.filter(item => item.itemStatus !== 'Cancelled');
        order.totalPrice = remainingActiveItems.reduce((total, item) => total + item.finalPrice, 0);

        if (remainingActiveItems.length > 0) {
            order.totalPrice += 50;
        }

        if (remainingActiveItems.length === 0) {
            order.orderStatus = 'Cancelled';
        }

        await order.save();

        res.status(200).json({
            success: true,
            message: 'Order item cancelled successfully. Refund has been processed to your wallet.',
            updatedTotalPrice: order.totalPrice,
            refundAmount: refundAmount
        });

    } catch (error) {
        console.error('Error in cancelOrderItem:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while cancelling the order item'
        });
    }
};


//return order
const returnOrderItem = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { productName, reason } = req.body;

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const itemToReturn = order.items.find(item => 
            item.productName === productName && item.itemStatus === 'Delivered'
        );

        if (!itemToReturn) {
            return res.status(400).json({
                success: false,
                message: 'Item cannot be returned'
            });
        }

        let refundAmount = itemToReturn.finalPrice;
        if (order.appliedCoupon) {
            const proportionalDiscount = (itemToReturn.finalPrice / order.totalPrice) * order.appliedCoupon.discountAmount;
            refundAmount = itemToReturn.finalPrice - proportionalDiscount;
        }

        const remainingItems = order.items.filter(item => 
            item.itemStatus !== 'Cancelled' && 
            item.productName !== productName
        );

        if (remainingItems.length === 0) {
            refundAmount += 50;
        }


        if ((order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') && 
            order.paymentStatus === 'Paid') {
            let wallet = await Wallet.findOne({ userId: order.userId });
            
            if (!wallet) {
                wallet = new Wallet({
                    userId: order.userId,
                    balance: 0,
                    transactions: []
                });
            }

            const newBalance = wallet.balance + refundAmount;
            wallet.transactions.push({
                amount: refundAmount,
                type: 'credit',
                description: `Refund for returned item: ${itemToReturn.productName}`,
                orderId: order._id,
                balance: newBalance
            });

            wallet.balance = newBalance;
            await wallet.save();
        }

        itemToReturn.returnReason = reason;
        itemToReturn.returnStatus = 'Return Requested';
        itemToReturn.returnRequestDate = new Date();
        itemToReturn.itemStatus = 'Return Processed';
        itemToReturn.refundAmount = refundAmount;

        const activeItems = order.items.filter(item => item.itemStatus !== 'Cancelled');
        order.totalPrice = activeItems.reduce((total, item) => total + item.finalPrice, 0);
        
        if (activeItems.length > 0) {
            order.totalPrice += 50;
        }

        await order.save();

        const product = await Product.findById(itemToReturn.productId);
        if (product) {
            product.quantity += itemToReturn.quantity;
            await product.save();
        }

        res.json({
            success: true,
            message: 'Return request processed successfully. Refund has been added to your wallet.',
            returnStatus: 'Return Processed',
            refundAmount: refundAmount.toFixed(2)
        });

    } catch (error) {
        console.error('Error in returnOrderItem:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing the return request'
        });
    }
};

//download order summary
const generateOrderSummaryPDF = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ orderId }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: {
                path: 'category',
                model: 'Category',
                select: 'name'
            }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const doc = new PDFDocument({
            margin: 30,
            size: 'A4'
        });

        const filename = `order-summary-${orderId}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        doc.pipe(res);

        const drawBox = (title, startY, height) => {
            const boxPadding = 5;
            const pageWidth = doc.page.width - 60;

            doc.rect(30, startY, pageWidth, height)
               .stroke('#000000');
            
            doc.fill('#f0f0f0')
               .rect(30, startY, pageWidth, 20)
               .fill();
            
            doc.fill('#000000')
               .fontSize(12)
               .font('Helvetica-Bold')
               .text(title, 35, startY + 4, {
                   width: pageWidth - 10,
                   align: 'left'
               });

            return startY + 20 + boxPadding;
        };

        doc.fontSize(18)
           .font('Helvetica-Bold')
           .text('NESTORIA', { align: 'center' })

        let currentY = 50;
        let leftBoxWidth = (doc.page.width - 70) / 2;

        doc.rect(30, currentY, leftBoxWidth, 70).stroke();
        doc.fill('#f0f0f0')
           .rect(30, currentY, leftBoxWidth, 20)
           .fill();
        doc.fill('#000000')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Payment Details', 35, currentY + 4);
        
        doc.font('Helvetica')
           .fontSize(10)
           .text(`Payment Method: ${order.paymentMethod}`, 35, currentY + 25)
           .text(`Payment Status: ${order.paymentStatus}`, 35, currentY + 40);

        doc.rect(leftBoxWidth + 40, currentY, leftBoxWidth, 70).stroke();
        doc.fill('#f0f0f0')
           .rect(leftBoxWidth + 40, currentY, leftBoxWidth, 20)
           .fill();
        doc.fill('#000000')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Order Details', leftBoxWidth + 45, currentY + 4);
        
        doc.font('Helvetica')
           .fontSize(10)
           .text(`Order ID: ${order.orderId}`, leftBoxWidth + 45, currentY + 25)
           .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`, leftBoxWidth + 45, currentY + 40);

        currentY = 130;
        contentY = drawBox('Shipping Information', currentY, 85);
        
        doc.font('Helvetica')
           .fontSize(10)
           .text(`Name: ${order.address.name}`, 35, contentY)
           .text(`Phone: ${order.address.phone}`, 35, contentY + 15)
           .text(`Address: ${order.address.house}, ${order.address.district}`, 35, contentY + 30)
           .text(`${order.address.city}, ${order.address.state} - ${order.address.pincode}`, 35, contentY + 45);

        currentY = 225;
        contentY = drawBox('Product Details', currentY, 200);

        doc.font('Helvetica-Bold')
           .fontSize(10)
           .text('Image', 35, contentY, { width: 60 })
           .text('Product', 100, contentY, { width: 180 })
           .text('Category', 280, contentY, { width: 100 })
           .text('Qty', 380, contentY, { width: 40 })
           .text('Price', 420, contentY, { width: 70 });

        let productY = contentY + 15;
        const imageSize = 40;

        for (const item of order.items) {
            if (productY > 380) { 
                doc.addPage();
                currentY = 30;
                contentY = drawBox('Product Details (Continued)', currentY, 200);
                productY = contentY + 15;
            }

            try {
                const imagePath = path.join(__dirname, '..', 'public', 'uploads', item.productId.productImage[0]);
                if (fs.existsSync(imagePath)) {
                    doc.image(imagePath, 35, productY, {
                        fit: [imageSize, imageSize],
                        align: 'center',
                        valign: 'center'
                    });
                }
            } catch (error) {
                console.error('Error loading product image:', error);
            }

            doc.font('Helvetica')
               .fontSize(10)
               .text(item.productName, 100, productY + 10, { width: 180 })
               .text(item.productId.category.name, 280, productY + 10, { width: 100 })
               .text(item.quantity.toString(), 380, productY + 10, { width: 40 })
               .text(`₹${item.finalPrice.toFixed(2)}`, 420, productY + 10, { width: 70 });

            productY += 45;
        }

        currentY = productY + 20;
        contentY = drawBox('Order Summary', currentY, 100);

        const subtotal = order.items.reduce((sum, item) => sum + item.finalPrice, 0);
    
        doc.font('Helvetica')
           .fontSize(10);

        let summaryY = contentY + 5;
        doc.text('Subtotal:', 35, summaryY)
           .text(`₹${subtotal.toFixed(2)}`, 420, summaryY, { width: 70, align: 'right' });

        summaryY += 15;
        doc.text('Shipping Charge:', 35, summaryY)
           .text('₹50.00', 420, summaryY, { width: 70, align: 'right' });

        if (order.appliedCoupon) {
            summaryY += 15;
            doc.text(`Coupon Discount (${order.appliedCoupon.code}):`, 35, summaryY)
               .text(`-₹${order.appliedCoupon.discountAmount.toFixed(2)}`, 420, summaryY, { width: 70, align: 'right' });
        }

        summaryY += 20;
        doc.font('Helvetica-Bold')
           .text('Total Amount:', 35, summaryY)
           .text(`₹${order.totalPrice.toFixed(2)}`, 420, summaryY, { width: 70, align: 'right' });

        doc.font('Helvetica')
           .fontSize(9)
           .text('Thank you for shopping with us!', 0, doc.page.height - 50, {
               align: 'center',
               width: doc.page.width
           });

        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ success: false, message: 'Error generating PDF' });
    }
};

module.exports={
    createOrder,
    verifyRazorpayPayment,
    createRazorpayOrder,
    orderSuccess,
    getViewOrders,
    getOrderDetails,
    cancelOrderItem,
    returnOrderItem,
    generateOrderSummaryPDF
}