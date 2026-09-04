    import express from 'express';
    import type { Request, Response } from 'express';
    import mongoose from 'mongoose';
    import cors from 'cors';

    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // MongoDB Atlas Connection
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://kennethlim183_db_user:42es3uOkM7ZdTEE5@shelflifeai.r3dcblh.mongodb.net/?appName=ShelfLifeAI';

    export async function connectToDatabase() {
    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection;
    }
    return await mongoose.connect(MONGO_URI);
    }

    export const ServerDb = connectToDatabase;

    // Schemas
    const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, required: true },
    }, { timestamps: true });

    const RoleSchema = new mongoose.Schema({ name: { type: String, required: true } });

    // Models
    export const User = mongoose.models.User || mongoose.model('User', UserSchema);
    export const Role = mongoose.models.Role || mongoose.model('Role', RoleSchema);

    // Seed Default Roles & Admin Account
    // Replace your seedDefaults function with this:
// Seed Default Roles & Admin Account
    async function seedDefaults() {
    try {
        const roleCount = await Role.countDocuments();
        if (roleCount === 0) {
        await Role.insertMany([
            { name: 'Super Admin' },
            { name: 'Admin' },
            { name: 'Manager' },
            { name: 'Staff' }
        ]);
        console.log('Default roles seeded successfully!');
        }

        // Force create or update Super Admin account
        await User.findOneAndUpdate(
        { email: 'admin@shelflife.com' },
        {
            email: 'admin@shelflife.com',
            password: 'admin1234',
            firstName: 'System',
            lastName: 'Admin',
            role: 'Super Admin',
        },
        { upsert: true, returnDocument: 'after' }
        );
        console.log('SuperAdmin ready: admin@shelflife.com / admin1234');
    } catch (error) {
        console.error('Error seeding defaults:', error);
    }
    }

// Initialize Database & Start Server
connectToDatabase()
    .then(async () => {
    console.log('Connected to MongoDB Atlas');
    await seedDefaults();
    app.listen(5000, () => console.log('Server running on http://127.0.0.1:5000'));
    })
    .catch((err) => console.error('MongoDB connection error:', err));
    app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
        await connectToDatabase();
        const { email, password } = req.body;

        if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
        }

        res.json({
        message: 'Login successful',
        token: 'dummy-jwt-token-or-your-actual-jwt',
        user: {
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
        },
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Login authentication failed' });
    }
    });

    // GET: Fetch Roles
    app.get('/api/roles', async (_req: Request, res: Response) => {
    try {
        await connectToDatabase();
        const roles = await Role.find();
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
    });

    // POST: Create Account
    app.post('/api/accounts', async (req: Request, res: Response) => {
    try {
        await connectToDatabase();
        const { email, password, firstName, lastName, role } = req.body;
        const newUser = await User.create({ 
        email: email.trim().toLowerCase(), 
        password, 
        firstName, 
        lastName, 
        role 
        });
        res.status(201).json(newUser);
    } catch (error: any) {
        res.status(400).json({ error: error.message || 'Failed to create account' });
    }
    });

    // GET: Fetch All Accounts
    app.get('/api/accounts', async (_req: Request, res: Response) => {
    try {
        await connectToDatabase();
        const users = await User.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
    });

    // DELETE: Remove Account
    app.delete('/api/accounts/:id', async (req: Request, res: Response) => {
    try {
        await connectToDatabase();
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete account' });
    }
    });

    // Initialize Database & Start Server
    connectToDatabase()
    .then(async () => {
        console.log('Connected to MongoDB Atlas');
        await seedDefaults();
        app.listen(5000, '0.0.0.0', () => console.log('Server running on http://0.0.0.0:5000'));
    })
    .catch((err) => console.error('MongoDB connection error:', err));