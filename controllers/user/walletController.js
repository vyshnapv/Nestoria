const User = require("../../models/userModel");
const Wallet=require("../../models/walletModel")
const Order=require("../../models/orderModel")

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        
        // Get wallet details including transaction history
        const wallet = await Wallet.findOne({ userId })
            .populate({
                path: 'transactions.orderId',
                model: 'Order',
                select: 'orderId'
            });

        if (!wallet) {
            // Create wallet if it doesn't exist
            const newWallet = new Wallet({
                userId: userId,
                balance: 0,
                transactions: []
            });
            await newWallet.save();
            return res.render("wallet", { userData, wallet: newWallet });
        }

        res.render("wallet", { 
            userData,
            wallet: wallet 
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Error fetching wallet" });
    }
};

// Function to add money to wallet
const addToWallet = async (userId, amount, description, orderId = null) => {
    try {
        let wallet = await Wallet.findOne({ userId });
        
        if (!wallet) {
            wallet = new Wallet({
                userId,
                balance: 0,
                transactions: []
            });
        }

        // Add new transaction
        const newBalance = wallet.balance + amount;
        wallet.transactions.push({
            amount,
            type: 'credit',
            description,
            orderId,
            balance: newBalance
        });

        wallet.balance = newBalance;
        await wallet.save();
        
        return wallet;
    } catch (error) {
        console.error('Error adding to wallet:', error);
        throw error;
    }
};

module.exports = {
    loadWallet,
    addToWallet
  };
  