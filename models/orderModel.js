const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },
    totalPrice: {
        type: Number,
        required: true,
    },
    items: [
        {
            productId: {
                type: Schema.Types.ObjectId,
                required: true,
                ref: "Product"
            },
            productName: {
                type: String,
                required: true
            },
            quantity: {
                type: Number,
                required: true
            },
            itemStatus: {
                type: String,
                required: true,
                default: "Ordered"
            },
            price: {
                type: Number,
                required: true
            },
            finalPrice: {
                type: Number,
                required: true
            },
            reason: {
                type: String,
            },
            isApproved: {
                type: Boolean,
            },
        },
    ],
    address: {
        name: {
            type: String
        },
        phone: {
            type: String
        },
        district: {
            type: String
        },
        city: {
            type: String
        },
        house: {
            type: String
        },
        state: {
            type: String
        },
        pincode: {
            type: String
        },
    },
    paymentMethod: {
        type: String,
        enum:['COD'],
        required: true,
    },
    paymentStatus: {
        type: String,
        enum:['Paid','Pending'],
        required: true
    },
    orderStatus: {
        type: String,
        required: true,
        enum:['Processing','Shipped','Delivered','Cancelled','Return Request','Returned'],
        default: "Processing"
    }
},{timestamps:true});

module.exports = mongoose.model("Order", OrderSchema);