import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type Row = Record<string, unknown>;

type MinimalError = { message: string } | null;
type Q<T> = Promise<{ data: T; error: MinimalError }>;
const db = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      eq: (col: string, v: string) => {
        order: (col: string, opts?: { ascending: boolean }) => Q<Row[] | null>;
      };
    };
    insert: (v: Row) => Q<null>;
    delete: () => { eq: (col: string, v: string) => Q<null> };
    update: (v: Row) => { eq: (col: string, v: string) => Q<null> };
  };
};

export type FieldType = "text" | "textarea" | "date" | "datetime" | "number" | "select";
export type FieldDef = {
  key: string;
  label: string;
  type?: FieldType;
  options?: readonly string[];
  required?: boolean;
  placeholder?: string;
  half?: boolean;
};
export type ColumnDef = {
  key: string;
  label: string;
  render?: (row: Row) => React.ReactNode;
};

export const text = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
export const pretty = (v: unknown) => text(v).replace(/_/g, " ");
export const dateText = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString() : "—");
export const dateTimeText = (v: unknown) => (v ? new Date(String(v)).toLocaleString() : "—");

/**
 * Generic tenant-scoped list + add + delete panel for the patient clinical
 * child tables (allergies, diagnoses, history, immunizations, follow-ups…).
 */
export function ClinicalPanel({
  table, patientId, title, description, fields, columns, orderBy, ascending = false,
  canEdit, addLabel = "Add", extraPayload, transform, emptyText = "Nothing recorded yet.", onChanged,
}: {
  table: string;
  patientId: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  orderBy: string;
  ascending?: boolean;
  canEdit: boolean;
  addLabel?: string;
  extraPayload?: Row;
  transform?: (values: Record<string, string>) => Row;
  emptyText?: string;
  onChanged?: () => void;
}) {
  const { currentTenantId, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from(table).select("*").eq("patient_id", patientId).order(orderBy, { ascending });
    setRows(data ?? []);
  }, [table, patientId, orderBy, ascending]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!currentTenantId || !user) return;
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) return toast.error(`${f.label} is required`);
    }
    setSaving(true);
    const payload: Row = { tenant_id: currentTenantId, patient_id: patientId, ...(extraPayload ?? {}) };
    for (const f of fields) {
      const raw = values[f.key];
      if (raw === undefined || raw === "") { payload[f.key] = null; continue; }
      payload[f.key] = f.type === "number" ? Number(raw) : raw;
    }
    Object.assign(payload, transform ? transform(values) : {});
    const { error } = await db.from(table).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setValues({});
    setOpen(false);
    void load();
    onChanged?.();
  };

  const remove = async (id: string) => {
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
    onChanged?.();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">{title} <Badge variant="secondary" className="ml-1">{rows.length}</Badge></CardTitle>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />{addLabel}</Button></DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{addLabel}</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.key} className={f.half ? "" : "sm:col-span-2"}>
                    <Label>{f.label}{f.required ? " *" : ""}</Label>
                    {f.type === "textarea" ? (
                      <Textarea rows={2} value={values[f.key] ?? ""} placeholder={f.placeholder}
                        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                    ) : f.type === "select" ? (
                      <Select value={values[f.key] ?? ""} onValueChange={(v) => setValues({ ...values, [f.key]: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((o) => <SelectItem key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={f.type === "date" ? "date" : f.type === "datetime" ? "datetime-local" : f.type === "number" ? "number" : "text"}
                        step={f.type === "number" ? "any" : undefined}
                        value={values[f.key] ?? ""} placeholder={f.placeholder}
                        onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
              <Button onClick={() => void save()} disabled={saving}>Save</Button>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">{emptyText}</div>}
        {rows.map((r) => (
          <div key={String(r.id)} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2">
              {columns.map((c) => (
                <div key={c.key} className="min-w-0 text-sm">
                  <span className="text-muted-foreground">{c.label}: </span>
                  <span className="break-words">{c.render ? c.render(r) : pretty(r[c.key])}</span>
                </div>
              ))}
            </div>
            {canEdit && (
              <Button size="icon" variant="ghost" onClick={() => void remove(String(r.id))} aria-label="Delete entry">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
