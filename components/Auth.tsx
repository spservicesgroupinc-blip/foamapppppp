import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { ShieldCheck, Loader2, HardHat } from 'lucide-react';

interface AuthProps {
  onLogin: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isEmployeeSignup, setIsEmployeeSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Check URL for invite parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    const inviteEmail = params.get('email');
    if (invite) {
      setIsEmployeeSignup(true);
      setIsLogin(false);
      setInviteCode(invite);
      if (inviteEmail) setEmail(decodeURIComponent(inviteEmail));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLogin();
      } else if (isEmployeeSignup) {
        // Employee signup with invite code
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              invite_code: inviteCode,
              display_name: displayName || email,
              role: 'employee',
            },
          },
        });
        if (error) throw error;
        setMessage('Account created! Check your email for the confirmation link, then log in.');
        // Clear invite params from URL
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        // Admin signup
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              company: company || 'My Spray Foam Co',
              display_name: email,
            },
          },
        });
        if (error) throw error;
        setMessage('Check your email for the confirmation link! Once confirmed, you can log in.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 bg-black text-center border-b-4 border-brand-600">
           {/* Logo Representation */}
           <div className="flex items-center justify-center gap-3 mb-4 select-none">
              <div className="bg-brand-600 px-3 py-1 transform -skew-x-12">
                <span className="text-white font-black italic text-3xl transform skew-x-12 block leading-none">RFE</span>
              </div>
              <div className="flex flex-col items-start">
                 <h1 className="text-2xl font-bold text-white leading-none tracking-wide">FOAM EQUIP.</h1>
              </div>
           </div>
           <p className="text-accent-400 font-bold tracking-widest text-sm uppercase">Contractor Management System</p>
        </div>
        
        <div className="p-8">
          <div className="flex gap-4 mb-6 border-b border-slate-100 pb-2">
            <button 
              className={`flex-1 pb-2 text-sm font-medium transition-colors ${isLogin && !isEmployeeSignup ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-400'}`}
              onClick={() => { setIsLogin(true); setIsEmployeeSignup(false); setError(null); setMessage(null); }}
            >
              Login
            </button>
            <button 
              className={`flex-1 pb-2 text-sm font-medium transition-colors ${!isLogin && !isEmployeeSignup ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-400'}`}
              onClick={() => { setIsLogin(false); setIsEmployeeSignup(false); setError(null); setMessage(null); }}
            >
              Register Company
            </button>
          </div>

          {/* Employee signup banner */}
          {isEmployeeSignup && (
            <div className="mb-4 p-3 bg-brand-50 border border-brand-200 rounded-lg flex items-center gap-2">
              <HardHat className="w-5 h-5 text-brand-600" />
              <p className="text-sm text-brand-700 font-medium">Employee Account Setup</p>
            </div>
          )}

          {/* Employee login shortcut (below main tabs) */}
          {isLogin && !isEmployeeSignup && (
            <div className="mb-4 text-center">
              <button
                onClick={() => { setIsLogin(false); setIsEmployeeSignup(true); setError(null); setMessage(null); }}
                className="text-xs text-slate-400 hover:text-brand-600 transition-colors"
              >
                Employee? Sign up with invite link
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isEmployeeSignup && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="e.g. Acme Insulation"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required={!isLogin && !isEmployeeSignup}
                />
              </div>
            )}

            {isEmployeeSignup && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="John Smith"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input 
                type="email" 
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
              {loading ? 'Please wait...' : isLogin ? 'Access Dashboard' : isEmployeeSignup ? 'Create Employee Account' : 'Create Account'}
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-slate-400">
            By continuing, you agree to the Terms of Service.
            <br/>Secured with Supabase Authentication.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;