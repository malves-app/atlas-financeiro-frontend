import { newGoalFormProps } from "@/lib/goal-form";
import { readParams, type SearchParams } from "@/lib/page";
import { GoalForm } from "@/components/GoalForm";
import { SheetHeader } from "@/components/Modal";

export const dynamic = "force-dynamic";

export default async function NovaMetaModal({ searchParams }: { searchParams: SearchParams }) {
  const { month, get } = await readParams(searchParams);
  const props = await newGoalFormProps(month, get("tipo") ?? "");
  return (
    <>
      <SheetHeader title="Nova meta" />
      <GoalForm {...props} mode="modal" />
    </>
  );
}
