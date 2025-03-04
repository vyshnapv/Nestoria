const User = require("../../models/userModel");
const Wallet=require("../../models/walletModel")
const Order=require("../../models/orderModel")

//load wallet page
const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });

        const page = parseInt(req.query.page)||1;
        limit=5;   

        const wallet = await Wallet.findOne({ userId })
            .populate({
                path: 'transactions.orderId',
                model: 'Order',
                select: 'orderId'
            });

        if (!wallet) {
            const newWallet = new Wallet({
                userId: userId,
                balance: 0,
                transactions: []
            });
            await newWallet.save();
            return res.render("wallet", { 
                userData, 
                wallet: newWallet,
                paginatedTransactions: [],
                currentPage: 1,
                totalPages: 1
            });
        }

        const sortedTransactions = wallet.transactions.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        const totalTransactions = sortedTransactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = Math.min(startIndex + limit, totalTransactions);

        const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

        res.render("wallet", { 
            userData,
            wallet: wallet,
            paginatedTransactions: paginatedTransactions,
            currentPage: page,
            totalPages: totalPages
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
  