const User = require("../../models/userModel");
const Referral = require("../../models/referralModel");
const Wallet = require("../../models/walletModel");
const crypto = require('crypto');

// Generate unique referral code
const generateReferralCode = () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Get referral offer page
const getReferalOffer = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const userData = await User.findById(req.session.user);
        let referral = await Referral.findOne({ referrer: req.session.user })
            .populate('referees.user', 'name email')
            .lean();//to get the plain js object

        if (!referral) {
            referral = new Referral({
                referralCode: generateReferralCode(),
                referrer: req.session.user,
                referees: []
            });
            await referral.save();
        }

        const totalReferees = referral.referees.length;
        const totalPages = Math.ceil(totalReferees / limit);

        referral.referees = referral.referees.slice(skip, skip + limit);

        res.render('referralOffer', { 
            userData, 
            referral,
            pagination: {
                page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

// Apply referral code during registration
const applyReferralCode = async (req, res) => {
    try {
        const { referralCode } = req.body;
        const newUserId = req.session.user;

        const referral = await Referral.findOne({ referralCode });
        if (!referral) {
            return res.status(400).json({ success: false, message: "Invalid referral code" });
        }

        const userReferral = await Referral.findOne({ 'referees.user': newUserId });
        if (userReferral) {
            return res.status(400).json({ success: false, message: "You have already used a referral code" });
        }

        referral.referees.push({
            user: newUserId,
            rewardStatus: 'Pending',
            rewardAmount: 25,
        });

        const referrerWallet = await Wallet.findOne({ userId: referral.referrer });
        if (!referrerWallet) {
            return res.status(400).json({ success: false, message: "Referrer wallet not found" });
        }

        await Promise.all([
            Wallet.findOneAndUpdate(
                { userId: referral.referrer },
                {
                    $inc: { balance: 25 },
                    $push: {
                        transactions: {
                            amount: 25,
                            type: 'credit',
                            description: 'Referral Reward - New user signup',
                            balance: referrerWallet.balance + 25
                        }
                    }
                }
            ),
            Wallet.findOneAndUpdate(
                { userId: newUserId },
                {
                    $inc: { balance: 50 },
                    $push: {
                        transactions: {
                            amount: 50,
                            type: 'credit',
                            description: 'Welcome Bonus - Referral reward',
                            balance: 50
                        }
                    }
                },
                { upsert: true, new: true }
            )
        ]);

        referral.totalRewards += 25;
        await referral.save();

        res.json({ success: true, message: "Referral reward applied successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

//generate referal code 
const generateNewReferralCode = async (req, res) => {
    try {
        const userId = req.session.user;
        const newCode = generateReferralCode();

        const updatedReferral = await Referral.findOneAndUpdate(
            { referrer: userId },
            { referralCode: newCode },
            { new: true }
        );

        if (!updatedReferral) {
            return res.status(404).json({ 
                success: false, 
                message: "Referral not found" 
            });
        }

        res.json({ 
            success: true, 
            newCode: updatedReferral.referralCode 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: "Internal server error" 
        });
    }
};

module.exports = {
    getReferalOffer,
    applyReferralCode,
    generateNewReferralCode
};