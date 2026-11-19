import { Suspense } from "react";
import { BottomNav, LaunchButton, SideNav } from "@/components/BottomNav";
import { Toast } from "@/components/Toast";
import { getUserEmail } from "@/lib/data";

export default async function AppLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const email = await getUserEmail();
  return (
    <>
      <Suspense>
        <SideNav email={email} />
      </Suspense>
      <div className="lg:pl-60">
        <main className="mx-auto max-w-xl pb-[calc(96px+env(safe-area-inset-bottom))] lg:max-w-4xl lg:px-8 lg:pt-4 lg:pb-28 xl:max-w-5xl 2xl:max-w-6xl">
          {children}
        </main>
      </div>
      {modal}
      <Suspense>
        <Toast />
        <BottomNav />
        <LaunchButton />
      </Suspense>
    </>
  );
}
