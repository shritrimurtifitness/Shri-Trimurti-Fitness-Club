import StaffScanner from "@/components/staff/StaffScanner";

export default function AdminScanner() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <StaffScanner />
      </div>
    </div>
  );
}
