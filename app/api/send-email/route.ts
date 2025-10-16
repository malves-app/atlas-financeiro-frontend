import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email é obrigatório" },
        { status: 400 }
      );
    }

    // Configuração do transporter (usando Gmail SMTP)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Seu email Gmail
        pass: process.env.EMAIL_PASS, // Sua senha de app do Gmail
      },
    });

    // Configuração do email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "malvesappbr@gmail.com",
      subject: "Nova inscrição - Atlas Financeiro",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">Nova Inscrição - Atlas Financeiro</h2>
          <p>Uma nova pessoa se inscreveu para receber notificações sobre o lançamento do Atlas Financeiro.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Detalhes da Inscrição:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleString("pt-BR")}</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Esta é uma notificação automática do sistema Atlas Financeiro.
          </p>
        </div>
      `,
    };

    // Enviar email
    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { message: "Email enviado com sucesso!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
