const mongoose = require('mongoose');

const wishlistSchema = mongoose.Schema({
    userId: {
        type:  mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true,
            },
            addedAt: {
                type: Date,
                default: Date.now
            }
        }]
},{ timestamps: true });

module.exports = mongoose.model("Wishlist", wishlistSchema);