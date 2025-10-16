"use client";

import { useState } from "react";
import { Globe, Mail, Check } from "lucide-react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        throw new Error("Erro ao enviar email");
      }
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao enviar email. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-900/10 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent"></div>

      <div className="relative z-10 max-w-2xl w-full text-center space-y-8 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="relative">
            <Globe
              className="w-10 h-10 text-amber-500 animate-glow"
              strokeWidth={1.5}
            />
            <div className="absolute inset-0 blur-xl bg-amber-500/30 animate-pulse-slow"></div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
            Atlas Financeiro
          </h1>
        </div>

        <div className="space-y-6">
          <p className="text-2xl md:text-3xl text-slate-200 font-light leading-relaxed">
            Navegue pelo seu mundo financeiro com clareza e controle.
          </p>

          <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-xl mx-auto">
            Estamos preparando algo incrível para transformar a forma como você
            organiza suas finanças.
          </p>
        </div>

        <div className="pt-8">
          <p className="text-sm text-slate-500 mb-4">
            Cadastre-se para ser avisado quando lançarmos.
          </p>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all backdrop-blur-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-8 py-4 bg-gradient-to-r from-amber-600 to-amber-500 text-white font-semibold rounded-lg hover:from-amber-500 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-amber-500/20"
                >
                  {isLoading ? "Enviando..." : "Avise-me"}
                </button>
              </div>
            </form>
          ) : (
            <div className="max-w-md mx-auto p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg backdrop-blur-sm animate-fade-in">
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <Check className="w-5 h-5" />
                <p className="font-semibold">
                  Obrigado! Você será notificado em breve.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="pt-12 flex items-center justify-center gap-2">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-700"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50"></div>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-700"></div>
        </div>
      </div>

      <footer className="relative z-10 mt-16 text-slate-600 text-sm">
        <p>&copy; 2025 Atlas Financeiro. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
