    import mongoose from 'mongoose';

    const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, required: true },
    }, { timestamps: true });

    const RoleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    });

    // Re-use models if already compiled in hot-reload
    export const User = mongoose.models.User || mongoose.model('User', UserSchema);
    export const Role = mongoose.models.Role || mongoose.model('Role', RoleSchema);

    // Automatically populates default roles in MongoDB if the collection is empty
    export async function seedRolesIfNeeded() {
    const count = await Role.countDocuments();
    if (count === 0) {
        await Role.insertMany([
        { name: 'SuperAdmin' },
        { name: 'Admin' },
        { name: 'User' },
        ]);
    }
    }