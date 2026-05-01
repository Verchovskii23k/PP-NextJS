"use client";
import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Панель администратора</h1>
      <ul className="space-y-2">
        <li><Link href="/admin/crud" className="text-blue-500 underline">CRUD</Link></li>
        <li><Link href="/admin/generations" className="text-blue-500 underline">Генерации</Link></li>
        <li><Link href="/admin/schedule" className="text-blue-500 underline">Расписание</Link></li>
      </ul>
    </div>
  );
}