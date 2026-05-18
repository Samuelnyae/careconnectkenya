import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bookkeeping")({
  component: () => <ProtectedLayout><BookkeepingPage /></ProtectedLayout>,
});

type Account = { id: string; code: string; name: string; type: "asset" | "liability" | "equity" | "revenue" | "expense"; is_active: boolean };
type Entry = { id: string; entry_date: string; memo: string | null; reference: string | null; posted: boolean; created_at: string };
type Line = { id: string; entry_id: string; account_id: string; debit: number; credit: number; memo: string | null };

const TYPES: Account["type"][] = ["asset", "liability", "equity", "revenue", "expense"];
const DEFAULTS: Array<{ code: string; name: string; type: Account["type"] }> = [
  { code: "1000", name: "Cash", type: "asset" },
  { code: "1100", name: "M-Pesa Wallet", type: "asset" },
  { code: "1200", name: "Accounts Receivable", type: "asset" },
  { code: "1300", name: "Inventory", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "4000", name: "Sales Revenue", type: "revenue" },
  { code: "4100", name: "Consultation Revenue", type: "revenue" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "5100", name: "Medication Loss", type: "expense" },
  { code: "5200", name: "Rent", type: "expense" },
  { code: "5300", name: "Salaries", type: "expense" },
];

type DraftLine = { account_id: string; debit: string; credit: string; memo: string };

function BookkeepingPage() {
  const { currentTenantId, user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [accDialog, setAccDialog] = useState(false);
  const [entryDialog, setEntryDialog] = useState(false);
  const [accForm, setAccForm] = useState({ code: "", name: "", type: "asset" as Account["type"] });
  const [entryForm, setEntryForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), memo: "", reference: "" });
  const [draftLines, setDraftLines] = useState<DraftLine[]>([
    { account_id: "", debit: "", credit: "", memo: "" },
    { account_id: "", debit: "", credit: "", memo: "" },
  ]);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const [a, e, l] = await Promise.all([
      supabase.from("accounts").select("id, code, name, type, is_active").eq("tenant_id", currentTenantId).order("code"),
      supabase.from("journal_entries").select("*").eq("tenant_id", currentTenantId).order("entry_date", { ascending: false }).limit(100),
      supabase.from("journal_lines").select("*").eq("tenant_id", currentTenantId).limit(2000),
    ]);
    setAccounts((a.data ?? []) as Account[]);
    setEntries((e.data ?? []) as Entry[]);
    setLines((l.data ?? []) as Line[]);
  }, [currentTenantId]);

  useEffect(() => { void load(); }, [load]);

  const seedDefaults = async () => {
    if (!currentTenantId) return;
    const { error } = await supabase.from("accounts").insert(DEFAULTS.map((d) => ({ ...d, tenant_id: currentTenantId })));
    if (error) return toast.error(error.message);
    toast.success("Default chart of accounts created");
    void load();
  };

  const addAccount = async () => {
    if (!currentTenantId || !accForm.code || !accForm.name) return;
    const { error } = await supabase.from("accounts").insert({ tenant_id: currentTenantId, ...accForm });
    if (error) return toast.error(error.message);
    toast.success("Account added");
    setAccDialog(false);
    setAccForm({ code: "", name: "", type: "asset" });
    void load();
  };

  const totals = useMemo(() => {
    const td = draftLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const tc = draftLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { td, tc, balanced: td === tc && td > 0 };
  }, [draftLines]);

  const updateLine = (i: number, k: keyof DraftLine, v: string) => {
    setDraftLines((arr) => arr.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  };

  const postEntry = async () => {
    if (!currentTenantId || !totals.balanced) return toast.error("Entry must balance");
    const valid = draftLines.filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (valid.length < 2) return toast.error("At least 2 lines required");

    const { data: entry, error: e1 } = await supabase.from("journal_entries").insert({
      tenant_id: currentTenantId,
      entry_date: entryForm.entry_date,
      memo: entryForm.memo || null,
      reference: entryForm.reference || null,
      posted: false,
      created_by: user?.id ?? null,
    }).select("id").single();
    if (e1 || !entry) return toast.error(e1?.message ?? "Failed");

    const { error: e2 } = await supabase.from("journal_lines").insert(valid.map((l) => ({
      entry_id: entry.id,
      tenant_id: currentTenantId,
      account_id: l.account_id,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      memo: l.memo || null,
    })));
    if (e2) return toast.error(e2.message);

    const { error: e3 } = await supabase.from("journal_entries").update({ posted: true }).eq("id", entry.id);
    if (e3) return toast.error(`Posted lines but failed to mark posted: ${e3.message}`);

    toast.success("Journal entry posted");
    setEntryDialog(false);
    setEntryForm({ entry_date: new Date().toISOString().slice(0, 10), memo: "", reference: "" });
    setDraftLines([{ account_id: "", debit: "", credit: "", memo: "" }, { account_id: "", debit: "", credit: "", memo: "" }]);
    void load();
  };

  // Trial balance
  const trialBalance = useMemo(() => {
    const byAcct = new Map<string, { debit: number; credit: number }>();
    for (const l of lines) {
      const row = byAcct.get(l.account_id) ?? { debit: 0, credit: 0 };
      row.debit += Number(l.debit) || 0;
      row.credit += Number(l.credit) || 0;
      byAcct.set(l.account_id, row);
    }
    return accounts.map((a) => {
      const v = byAcct.get(a.id) ?? { debit: 0, credit: 0 };
      const balance = (a.type === "asset" || a.type === "expense") ? v.debit - v.credit : v.credit - v.debit;
      return { ...a, debit: v.debit, credit: v.credit, balance };
    });
  }, [accounts, lines]);

  const tbTotals = useMemo(() => ({
    debit: trialBalance.reduce((s, r) => s + r.debit, 0),
    credit: trialBalance.reduce((s, r) => s + r.credit, 0),
  }), [trialBalance]);

  const pl = useMemo(() => {
    const rev = trialBalance.filter((r) => r.type === "revenue").reduce((s, r) => s + r.balance, 0);
    const exp = trialBalance.filter((r) => r.type === "expense").reduce((s, r) => s + r.balance, 0);
    return { rev, exp, net: rev - exp };
  }, [trialBalance]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><BookOpen className="h-7 w-7" /> Bookkeeping</h1>
        <p className="text-muted-foreground">Double-entry ledger with chart of accounts, journals, and trial balance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Revenue</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-success">KSh {pl.rev.toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Expenses</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">KSh {pl.exp.toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Net income</CardTitle></CardHeader><CardContent className={`text-2xl font-bold ${pl.net >= 0 ? "text-success" : "text-destructive"}`}>KSh {pl.net.toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Posted entries</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{entries.filter((e) => e.posted).length}</CardContent></Card>
      </div>

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
              <DialogTrigger asChild><Button disabled={accounts.length === 0}><Plus className="mr-2 h-4 w-4" />New entry</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New journal entry</DialogTitle></DialogHeader>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Date</Label><Input type="date" value={entryForm.entry_date} onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })} /></div>
                  <div className="space-y-1 col-span-2"><Label>Reference</Label><Input value={entryForm.reference} onChange={(e) => setEntryForm({ ...entryForm, reference: e.target.value })} placeholder="e.g. INV-001" /></div>
                  <div className="space-y-1 col-span-3"><Label>Memo</Label><Input value={entryForm.memo} onChange={(e) => setEntryForm({ ...entryForm, memo: e.target.value })} /></div>
                </div>
                <div className="space-y-2 mt-2">
                  <div className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
                    <div>Account</div><div>Debit</div><div>Credit</div><div>Memo</div><div></div>
                  </div>
                  {draftLines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 items-center">
                      <Select value={l.account_id} onValueChange={(v) => updateLine(i, "account_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                        <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" value={l.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} />
                      <Input type="number" value={l.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} />
                      <Input value={l.memo} onChange={(e) => updateLine(i, "memo", e.target.value)} />
                      <Button variant="ghost" size="icon" onClick={() => setDraftLines((arr) => arr.filter((_, idx) => idx !== i))} disabled={draftLines.length <= 2}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setDraftLines((a) => [...a, { account_id: "", debit: "", credit: "", memo: "" }])}><Plus className="mr-1 h-3 w-3" />Add line</Button>
                </div>
                <div className="flex items-center justify-between border-t pt-3 mt-2 text-sm">
                  <div>Debit: <strong>KSh {totals.td.toLocaleString()}</strong> · Credit: <strong>KSh {totals.tc.toLocaleString()}</strong></div>
                  <Badge variant={totals.balanced ? "default" : "destructive"}>{totals.balanced ? "Balanced" : "Unbalanced"}</Badge>
                </div>
                <DialogFooter><Button onClick={() => void postEntry()} disabled={!totals.balanced}><Save className="mr-2 h-4 w-4" />Post entry</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardHeader><CardTitle>Recent journal entries</CardTitle></CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No entries yet. Add the chart of accounts then post your first entry.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Memo</TableHead><TableHead>Lines</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {entries.map((e) => {
                      const eLines = lines.filter((l) => l.entry_id === e.id);
                      const amt = eLines.reduce((s, l) => s + Number(l.debit), 0);
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs">{e.entry_date}</TableCell>
                          <TableCell>{e.reference ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{e.memo ?? "—"}</TableCell>
                          <TableCell>{eLines.length}</TableCell>
                          <TableCell>KSh {amt.toLocaleString()}</TableCell>
                          <TableCell><Badge variant={e.posted ? "default" : "secondary"}>{e.posted ? "Posted" : "Draft"}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial">
          <Card>
            <CardHeader><CardTitle>Trial balance</CardTitle></CardHeader>
            <CardContent>
              {trialBalance.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Add accounts to see the trial balance.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {trialBalance.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.code}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{r.type}</Badge></TableCell>
                        <TableCell className="text-right">{r.debit ? `KSh ${r.debit.toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-right">{r.credit ? `KSh ${r.credit.toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-right font-medium">KSh {r.balance.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={3}>Totals</TableCell>
                      <TableCell className="text-right">KSh {tbTotals.debit.toLocaleString()}</TableCell>
                      <TableCell className="text-right">KSh {tbTotals.credit.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{tbTotals.debit === tbTotals.credit ? <Badge>Balanced</Badge> : <Badge variant="destructive">Off by KSh {(tbTotals.debit - tbTotals.credit).toLocaleString()}</Badge>}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-end gap-2">
            {accounts.length === 0 && <Button variant="outline" onClick={() => void seedDefaults()}>Seed Kenyan defaults</Button>}
            <Dialog open={accDialog} onOpenChange={setAccDialog}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add account</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="space-y-1"><Label>Code</Label><Input value={accForm.code} onChange={(e) => setAccForm({ ...accForm, code: e.target.value })} placeholder="e.g. 1400" /></div>
                  <div className="space-y-1"><Label>Name</Label><Input value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} /></div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={accForm.type} onValueChange={(v) => setAccForm({ ...accForm, type: v as Account["type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={() => void addAccount()}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardHeader><CardTitle>Chart of accounts ({accounts.length})</CardTitle></CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No accounts. Click "Seed Kenyan defaults" to start.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.code}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.type}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}