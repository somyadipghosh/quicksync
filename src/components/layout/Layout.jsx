import React from 'react';
import { useUserContext } from '../../contexts/UserContext';

const Layout = ({ children }) => {
  const { user } = useUserContext();
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">QuickSync</h1>
          {user && (
            <div className="text-sm font-medium text-gray-700">
              Hello, <span className="font-semibold">{user.name}</span>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">© 2025 QuickSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;