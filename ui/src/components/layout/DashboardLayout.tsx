import { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { TopBar } from "./TopBar";

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};
