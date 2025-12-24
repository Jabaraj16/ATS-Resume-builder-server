const User = require('../models/User');
const TempUser = require('../models/TempUser');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register user (Temporary) & Send OTP
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Check if user already exists in MAIN database
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // 2. Generate OTP
        const otp = generateOTP();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        // 3. Update or Create in TEMP database
        // We use findOneAndUpdate with upsert to handle re-sending/overwriting pending registrations
        // Note: We must explicitly hash password here if using findOneAndUpdate, OR use save() logic.
        // Using save() is cleaner for middleware (hashing) to run, so let's check duplicates manually.

        let tempUser = await TempUser.findOne({ email });
        if (tempUser) {
            // Update existing pending user
            tempUser.name = name;
            tempUser.password = password; // Request body password (plain), will be hashed by pre-save
            tempUser.otp = otp;
            tempUser.otpExpires = otpExpires;
            await tempUser.save();
        } else {
            // Create new pending user
            tempUser = await TempUser.create({
                name,
                email,
                password,
                otp,
                otpExpires
            });
        }

        // 4. Send OTP via Email
        const message = `Your OTP for Resume Builder registration is: ${otp}\n\nIt expires in 10 minutes.`;

        try {
            await sendEmail({
                email: tempUser.email,
                subject: 'Resume Builder - Verify Your Email',
                message
            });

            res.status(200).json({
                success: true,
                message: 'OTP sent to email. Please verify to complete registration.',
                email: tempUser.email
            });
        } catch (err) {
            console.error(err);
            await TempUser.findByIdAndDelete(tempUser._id);
            return res.status(500).json({ success: false, message: 'Email could not be sent. Please try again.' });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Verify OTP & Create Real User
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        console.log(`[VERIFY OTP] Request for Email: ${email}, OTP: ${otp}`);

        // 1. Find in TEMP database
        const tempUser = await TempUser.findOne({ email }).select('+password');

        if (!tempUser) {
            console.log(`[VERIFY OTP] TempUser not found for: ${email}`);
            return res.status(400).json({ success: false, message: 'Invalid or expired registration session. Please register again.' });
        }

        console.log(`[VERIFY OTP] Found TempUser: ${tempUser.email}`);
        console.log(`[VERIFY OTP] Stored OTP: '${tempUser.otp}'`);
        console.log(`[VERIFY OTP] Received OTP: '${otp}'`);

        // 2. Verify OTP
        if (tempUser.otp.trim() !== otp.trim()) {
            console.log(`[VERIFY OTP] FAILED: Mismatch`);
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        const now = Date.now();
        if (tempUser.otpExpires < now) {
            console.log(`[VERIFY OTP] FAILED: Expired. Expires: ${tempUser.otpExpires}, Now: ${now}`);
            return res.status(400).json({ success: false, message: 'OTP expired. Please register again.' });
        }

        // 3. Create REAL User
        // Note: tempUser.password is already hashed. User model might try to re-hash it if we are not careful.
        // If User model has pre-save hook that hashes if modified...
        // We should pass the HASHED password and ensure User model doesn't double-hash.
        // Usually, pre-save checks `isModified('password')`. If we set it, it is modified.
        // Trick: Set the hashed password directly and avoid triggering pre-save? 
        // Or better: The TempUser password IS encrypted. The User model expects a plain password to encrypt?
        // Let's look at User.js. It likely has a pre-save hook.
        // If we duplicate the hash, bcrypt will limit it but it's messy.
        // EASIEST WAY: We should strictly copy the fields.

        // HOWEVER, Mongoose `create` triggers save.
        // Fix: Update User model to only hash if password doesn't look like a hash? Or just trust the `isModified`?
        // Actually, if we pass the hashed string as 'password', logic treats it as new plain text.

        // ALTERNATIVE: Don't hash in TempUser? Store plain text? DANGEROUS.

        // SOLUTION: Use Mongoose `insertMany` (bypasses middleware) or careful logic. 
        // Let's try `current User` creation. If I pass the hashed password, and the pre-save hook runs...
        // The pre-save hook: `if (!this.isModified('password')) return next(); ... bcrypt.hash...`
        // It WILL double hash.

        // FIX: Let's create the User instance, set fields manually, and SAVE.
        // But we need to bypass the hook? 

        // Wait, simplify. Why not just let TempUser NOT hash the password?
        // "Don't save credentials". Storing plain text password in DB (even Temp) is bad practice.
        // But it's only for 10 minutes.
        // Still, let's stick to hashing in TempUser.

        // Strategy: When creating User, we can set `user.password = tempUser.password`.
        // Then we can use `User.findByIdAndUpdate` (upsert/create) or `User.collection.insertOne` to bypass Mongoose middleware.

        // Let's use `await User.create({...})` but we need to know if we can disable hook.
        // No easy way.

        // OK, I will remove the pre-save hook from TempUser for now OR I will use `User.collection.insertOne` (native driver) which definitely skips hooks.
        // `User.create` calls `save()`.

        // Let's go with `User.create` but we need the PLAIN password?
        // If TempUser has hashed password, we can't get plain password back.
        // So we MUST NOT hash in TempUser if we want to use standard User registration logic.
        // OR we manually write to DB.

        // Decision: I will modify TempUser to NOT hash password. 
        // PRO: Simpler flow. CON: Plain text password in TempUser for 10m.
        // Given the requirement "Don't save credentials" was for the *permanent* DB, this is a tradeoff. 
        // BUT storing plain text passwords is never good.

        // BETTER Decision: Hash in TempUser. Use `new User(...)` then overwrite password field directly on the document object? No.
        // Use `User.collection.insertOne(doc)`. This inserts raw JSON.
        // We need to match the schema structure (e.g. `_id`, `createdAt`).

        const finalUser = new User({
            name: tempUser.name,
            email: tempUser.email,
            password: tempUser.password, // Hashed
            isVerified: true
        });

        // We want to save this WITHOUT running the pre-save hook (which hashes).
        // Since we are validating structure, let's just insert it raw.
        await User.collection.insertOne({
            name: finalUser.name,
            email: finalUser.email,
            password: finalUser.password,
            isVerified: true,
            role: 'user', // default
            createdAt: new Date(),
            __v: 0
        });

        // 4. Delete TempUser
        await TempUser.findByIdAndDelete(tempUser._id);

        // 5. Send Token (Auto Login)
        // We need the `_id` for the token. `insertOne` returns result.
        // Actually, `finalUser._id` is generated by `new User`. We can use that.

        sendTokenResponse(finalUser, 201, res);

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        // 1. Check TempUser (for registration flow)
        let tempUser = await TempUser.findOne({ email });

        if (tempUser) {
            const otp = generateOTP();
            tempUser.otp = otp;
            tempUser.otpExpires = Date.now() + 10 * 60 * 1000;
            await tempUser.save();

            const message = `Your new OTP for Resume Builder registration is: ${otp}\n\nIt expires in 10 minutes.`;

            try {
                await sendEmail({
                    email: tempUser.email,
                    subject: 'Resume Builder - Resend OTP',
                    message
                });

                return res.status(200).json({ success: true, message: 'OTP resent to email' });
            } catch (err) {
                return res.status(500).json({ success: false, message: 'Email could not be sent' });
            }
        }

        // 2. Check Real User (only if not verified? but verified users don't need OTP typically unless login 2FA)
        // For now, if not in TempUser, user might have expired or not registered.
        // We can check if user is in main DB but unverified (legacy) or just return error.

        const user = await User.findOne({ email });
        if (user && !user.isVerified) {
            const otp = generateOTP();
            user.otp = otp;
            user.otpExpires = Date.now() + 10 * 60 * 1000;
            await user.save();

            const message = `Your new OTP for Resume Builder registration is: ${otp}\n\nIt expires in 10 minutes.`;
            await sendEmail({ email: user.email, subject: 'Resume Builder - Resend OTP', message });
            return res.status(200).json({ success: true, message: 'OTP resent to email' });
        }

        return res.status(400).json({ success: false, message: 'Registration session expired or user not found. Please register again.' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide an email and password' });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'This email is not registered' });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid password' });
        }

        // Check Verification
        if (!user.isVerified) {
            return res.status(401).json({
                success: false,
                message: 'Email not verified. Please verify your email.',
                isVerified: false
            });
        }

        sendTokenResponse(user, 200, res);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        const message = `Your OTP for password reset is: ${otp}\n\nIt expires in 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Resume Builder - Password Reset OTP',
                message
            });

            res.status(200).json({ success: true, message: 'OTP sent to email for password reset' });
        } catch (err) {
            user.otp = undefined;
            user.otpExpires = undefined;
            await user.save();
            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email }).select('+otp +otpExpires');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'OTP expired' });
        }

        user.password = newPassword;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successful. You can now login.' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper function to get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });

    res.status(statusCode).json({
        success: true,
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
};
