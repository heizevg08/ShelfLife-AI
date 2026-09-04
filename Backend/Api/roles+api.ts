

    import { ServerDb } from '../services/server';
    import { Role, seedRolesIfNeeded } from '../services/model';

    export async function GET() {
    try {
        await ServerDb();
        await seedRolesIfNeeded(); // Creates 'roles' collection on first fetch
        
        const roles = await Role.find();
        return Response.json(roles);
    } catch (error) {
        return Response.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }
    }