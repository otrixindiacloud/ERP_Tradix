import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
const SupplierEditSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
});

export default function EditSupplier() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: zodResolver(SupplierEditSchema),
  });

  // Fetch supplier details
  const { data: supplier, isLoading } = useQuery({
    queryKey: ["/api/suppliers/" + id + "/details"],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${id}/details`);
      if (!res.ok) throw new Error("Failed to fetch supplier");
      return res.json();
    },
    enabled: !!id,
    onSuccess: (data: any) => {
      reset({
        name: data.supplier.name,
        contactPerson: data.supplier.contactPerson,
        email: data.supplier.email,
        phone: data.supplier.phone,
        address: data.supplier.address,
        paymentTerms: data.supplier.paymentTerms,
      });
    },
  });

  // Mutation for updating supplier
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async (formData: z.infer<typeof SupplierEditSchema>) => {
      const res = await fetch(`/api/suppliers/${id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to update supplier");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Supplier updated successfully" });
      navigate(`/suppliers/${id}`);
    },
    onError: () => {
      toast({ title: "Failed to update supplier", variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof SupplierEditSchema>) => {
    mutation.mutate(data);
  };

  if (isLoading) return <div className="container mx-auto py-8">Loading...</div>;

  return (
    <div className="container mx-auto py-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit Supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Contact Person</label>
              <Input {...register("contactPerson")} />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input {...register("email")} />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input {...register("phone")} />
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input {...register("address")} />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Terms</label>
              <Input {...register("paymentTerms")} />
            </div>
            <Separator />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
