// Replace the top imports with these corrected relative paths:
import { connectToDatabase } from '../services/server';
import { User } from '../services/model';

    export async function GET() {
    try {
        await connectToDatabase();
        const users = await User.find().sort({ createdAt: -1 });
        return Response.json(users);
    } catch (error) {
        return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
    }

    export async function POST(request: Request) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { email, firstName, lastName, role } = body;

        // Creates the document and automatically creates 'users' collection in Atlas
        const newUser = await User.create({ email, firstName, lastName, role });
        return Response.json(newUser, { status: 201 });
    } catch (error: any) {
        return Response.json(
        { error: error.message || 'Failed to create user account' }, 
        { status: 400 }
        );
    }
    }