const mongoose = require("mongoose");
const { Schema } = mongoose;

const offerSchema = new Schema(
    {
        offerType: {
            type: String,
            enum: ["Product", "Category"],
            required: true,
        },
        offerName: {
            type: String,
            required: true,
        },
        discount: {
            type: Number,
            required: true,
        },
        expireDate: {
            type: Date,
            required: true,
        },
        productIds: [{
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: function () {
                return this.offerType === "Product";
            },
        }],
        categoryIds: [{
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: function () {
                return this.offerType === "Category";
            },
        }],
        referralCode: {
            type: String,
            required: false,
        },
        status: {
            type: String,
            enum:['Active', 'Inactive'],
            default: "Active'",
        },
        isBlocked: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const Offer = mongoose.model("Offer", offerSchema);
module.exports = Offer;
