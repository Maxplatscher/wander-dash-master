import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteDriverAccount, isValidInviteEmail } from "@/lib/invite-driver";
import { parseOptionalMm } from "@/lib/vehicle-volume";

interface AddDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const EMPTY_DRIVER = {
  name: "",
  phone: "",
  email: "",
  vehicleName: "",
  vehicleCapacity: "",
  vehicleLengthMm: "",
  vehicleWidthMm: "",
  vehicleHeightMm: "",
  hints: "",
};

export function AddDriverDialog({
  open,
  onOpenChange,
  onCreated,
}: AddDriverDialogProps) {
  const queryClient = useQueryClient();
  const [newDriver, setNewDriver] = useState(EMPTY_DRIVER);
  const [selectedVehicleId, setSelectedVehicleId] = useState("new");
  const [saving, setSaving] = useState(false);

  const { data: existingVehicles } = useQuery({
    queryKey: ["vehicles-for-driver"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicle")
        .select("id, name, capacity");
      return data ?? [];
    },
  });

  const handleAddDriver = async () => {
    if (!newDriver.name.trim()) return;
    setSaving(true);
    try {
      const { data: companyId } = await supabase.rpc("get_user_company_id");
      if (!companyId) throw new Error("Kein Unternehmen zugeordnet");

      let vehicleId: string | null = null;
      if (selectedVehicleId === "new" && newDriver.vehicleName.trim()) {
        const { data: vehicle, error } = await supabase
          .from("vehicle")
          .insert({
            name: newDriver.vehicleName.trim(),
            capacity: newDriver.vehicleCapacity
              ? parseInt(newDriver.vehicleCapacity, 10)
              : null,
            length_mm: parseOptionalMm(newDriver.vehicleLengthMm),
            width_mm: parseOptionalMm(newDriver.vehicleWidthMm),
            height_mm: parseOptionalMm(newDriver.vehicleHeightMm),
            company_id: companyId,
          })
          .select("id")
          .single();
        if (error) throw error;
        vehicleId = vehicle.id;
      } else if (selectedVehicleId !== "new") {
        vehicleId = selectedVehicleId;
      }

      const { data: created, error } = await supabase.from("driver").insert({
        name: newDriver.name.trim(),
        phone: newDriver.phone.trim() || null,
        company_id: companyId,
        status: "verfügbar",
        assigned_vehicle_id: vehicleId,
        notes: newDriver.hints.trim() || null,
      }).select("id").single();
      if (error) throw error;

      let inviteNote = "";
      if (created?.id && newDriver.email.trim()) {
        if (!isValidInviteEmail(newDriver.email)) {
          throw new Error("Bitte eine gültige Login-E-Mail angeben.");
        }
        const invite = await inviteDriverAccount(created.id, newDriver.email);
        if (!invite.success) {
          inviteNote = ` Fahrer gespeichert, Zugang nicht angelegt: ${invite.error}`;
        } else if (invite.temporary_password) {
          inviteNote = ` Login ${invite.email} · Startpasswort ${invite.temporary_password}`;
        }
      }

      toast.success(`Fahrer & Fahrzeug hinzugefügt.${inviteNote}`, {
        duration: inviteNote ? 20_000 : 4000,
      });
      setNewDriver(EMPTY_DRIVER);
      setSelectedVehicleId("new");
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["active-drivers-tour"] }),
        queryClient.invalidateQueries({ queryKey: ["drivers"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles-for-driver"] }),
        queryClient.invalidateQueries({ queryKey: ["kpis"] }),
      ]);
      onCreated?.();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Fehler beim Speichern",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-hairline">
        <DialogHeader>
          <DialogTitle>Neuen Fahrer hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Name *
            </label>
            <Input
              placeholder="z.B. Max Müller"
              value={newDriver.name}
              onChange={(event) =>
                setNewDriver((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Login-E-Mail
            </label>
            <Input
              type="email"
              placeholder="fahrer@firma.de — legt den Zugang an"
              value={newDriver.email}
              onChange={(event) =>
                setNewDriver((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Telefon
            </label>
            <Input
              placeholder="+49 171 ..."
              value={newDriver.phone}
              onChange={(event) =>
                setNewDriver((previous) => ({
                  ...previous,
                  phone: event.target.value,
                }))
              }
            />
          </div>
          <div className="border-t border-hairline pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-primary" />
              <label className="text-sm font-semibold text-foreground">
                Fahrzeug zuweisen
              </label>
            </div>
            {existingVehicles?.length ? (
              <>
                <Select
                  value={selectedVehicleId}
                  onValueChange={setSelectedVehicleId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Fahrzeug wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      + Neues Fahrzeug anlegen
                    </SelectItem>
                    {existingVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name}{" "}
                        {vehicle.capacity ? `(${vehicle.capacity} kg)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedVehicleId === "new" && (
                  <div className="mt-3 space-y-3 pl-2 border-l-2 border-primary/30">
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Fahrzeugname *
                      </label>
                      <Input
                        placeholder="z.B. Sprinter 1"
                        value={newDriver.vehicleName}
                        onChange={(event) =>
                          setNewDriver((previous) => ({
                            ...previous,
                            vehicleName: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Kapazität (kg)
                      </label>
                      <Input
                        type="number"
                        placeholder="z.B. 1500"
                        value={newDriver.vehicleCapacity}
                        onChange={(event) =>
                          setNewDriver((previous) => ({
                            ...previous,
                            vehicleCapacity: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        placeholder="L mm"
                        value={newDriver.vehicleLengthMm}
                        onChange={(event) =>
                          setNewDriver((previous) => ({
                            ...previous,
                            vehicleLengthMm: event.target.value,
                          }))
                        }
                      />
                      <Input
                        type="number"
                        placeholder="B mm"
                        value={newDriver.vehicleWidthMm}
                        onChange={(event) =>
                          setNewDriver((previous) => ({
                            ...previous,
                            vehicleWidthMm: event.target.value,
                          }))
                        }
                      />
                      <Input
                        type="number"
                        placeholder="H mm"
                        value={newDriver.vehicleHeightMm}
                        onChange={(event) =>
                          setNewDriver((previous) => ({
                            ...previous,
                            vehicleHeightMm: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="meta-text">
                  Noch kein Fahrzeug vorhanden – lege eines an:
                </p>
                <Input
                  placeholder="Fahrzeugname *"
                  value={newDriver.vehicleName}
                  onChange={(event) =>
                    setNewDriver((previous) => ({
                      ...previous,
                      vehicleName: event.target.value,
                    }))
                  }
                />
                <Input
                  type="number"
                  placeholder="Kapazität (kg)"
                  value={newDriver.vehicleCapacity}
                  onChange={(event) =>
                    setNewDriver((previous) => ({
                      ...previous,
                      vehicleCapacity: event.target.value,
                    }))
                  }
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    placeholder="L mm"
                    value={newDriver.vehicleLengthMm}
                    onChange={(event) =>
                      setNewDriver((previous) => ({
                        ...previous,
                        vehicleLengthMm: event.target.value,
                      }))
                    }
                  />
                  <Input
                    type="number"
                    placeholder="B mm"
                    value={newDriver.vehicleWidthMm}
                    onChange={(event) =>
                      setNewDriver((previous) => ({
                        ...previous,
                        vehicleWidthMm: event.target.value,
                      }))
                    }
                  />
                  <Input
                    type="number"
                    placeholder="H mm"
                    value={newDriver.vehicleHeightMm}
                    onChange={(event) =>
                      setNewDriver((previous) => ({
                        ...previous,
                        vehicleHeightMm: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-hairline pt-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-warning" />
              <label className="text-sm font-semibold">Hinweise</label>
            </div>
            <Textarea
              placeholder="z.B. kennt Gebiet Nord gut…"
              value={newDriver.hints}
              onChange={(event) =>
                setNewDriver((previous) => ({
                  ...previous,
                  hints: event.target.value,
                }))
              }
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => void handleAddDriver()}
              disabled={saving || !newDriver.name.trim()}
            >
              {saving ? "Speichern…" : "Fahrer anlegen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
