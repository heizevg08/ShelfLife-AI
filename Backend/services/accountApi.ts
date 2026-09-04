    const API_BASE = 'http://192.168.X.X:5000/api/accounts'; 

    export interface Account {
    _id?: string;
    name: string;
    email: string;
    role: string;
    }

    export const fetchAccounts = async (): Promise<Account[]> => {
    const res = await fetch(API_BASE);
    return res.json();
    };

    export const createAccount = async (account: Omit<Account, '_id'>): Promise<Account> => {
    const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
    });
    return res.json();
    };

    export const updateAccount = async (id: string, data: Partial<Account>): Promise<Account> => {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
    };

    export const deleteAccount = async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    return res.json();
    };