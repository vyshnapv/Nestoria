const mongoose = require('mongoose');

const couponSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    couponCode: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String
    },
    percentage: {
        type: Number,
        required: true,
        min: 1,
        max: 80
    },
    minPrice: {
        type: Number,
        default: 0
    },
    maxRedeemAmount: {
        type: Number,
    },
    addedDate: {
        type: Date,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    redeemedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
});

module.exports = mongoose.model("Coupon",couponSchema);