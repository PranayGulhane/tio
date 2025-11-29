import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Users,
  Sparkles,
  TrendingUp,
  Plus,
  MoreVertical,
  Power,
  Key,
  Store,
  Loader2,
  Activity,
  ShoppingBag,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Store as StoreType } from "@shared/schema";

const createStoreSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  storeName: z.string().min(1, "Store name is required"),
  storeDescription: z.string().optional(),
});

type CreateStoreFormData = z.infer<typeof createStoreSchema>;

interface StoreWithStats extends StoreType {
  managerEmail?: string;
  stats: {
    clothingCount: number;
    tryOnCount: number;
    sessionCount: number;
  };
}

interface PlatformStats {
  totalStores: number;
  totalApiCalls: number;
  totalSessions: number;
  totalClothingItems: number;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
}: {
  title: string;
  value: string | number;
  icon: typeof Building2;
  description?: string;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            <TrendingUp className={`h-3 w-3 ${!trend.isPositive && "rotate-180"}`} />
            <span>{trend.value}% from last week</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StoreCard({ store, onToggleStatus, onResetPassword }: {
  store: StoreWithStats;
  onToggleStatus: (storeId: string) => void;
  onResetPassword: (storeId: string) => void;
}) {
  return (
    <Card className="hover-elevate">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">{store.name}</CardTitle>
            <CardDescription className="text-xs">{store.managerEmail}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={store.isActive ? "default" : "secondary"} className="text-xs">
            {store.isActive ? "Active" : "Inactive"}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-store-menu-${store.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToggleStatus(store.id)}>
                <Power className="mr-2 h-4 w-4" />
                {store.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResetPassword(store.id)}>
                <Key className="mr-2 h-4 w-4" />
                Reset Password
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {store.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{store.description}</p>
        )}
        <div className="grid grid-cols-3 gap-4 pt-3 border-t">
          <div className="text-center">
            <div className="text-lg font-semibold">{store.stats.clothingCount}</div>
            <div className="text-xs text-muted-foreground">Items</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{store.stats.tryOnCount}</div>
            <div className="text-xs text-muted-foreground">Try-ons</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{store.stats.sessionCount}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OwnerDashboard() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const form = useForm<CreateStoreFormData>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: {
      email: "",
      storeName: "",
      storeDescription: "",
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/analytics/global"],
  });

  const { data: stores, isLoading: storesLoading } = useQuery<StoreWithStats[]>({
    queryKey: ["/api/stores"],
  });

  const createStoreMutation = useMutation({
    mutationFn: async (data: CreateStoreFormData) => {
      return await apiRequest("POST", "/api/stores", data);
    },
    onSuccess: (data: { tempPassword?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/global"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Store created successfully",
        description: data.tempPassword
          ? `Temporary password: ${data.tempPassword}. Please share this with the store manager.`
          : "Store has been created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create store",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (storeId: string) => {
      return await apiRequest("PATCH", `/api/stores/${storeId}/toggle-status`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
      toast({
        title: "Status updated",
        description: "Store status has been changed.",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (storeId: string) => {
      return await apiRequest("POST", `/api/stores/${storeId}/reset-password`, {});
    },
    onSuccess: (data: { tempPassword?: string }) => {
      toast({
        title: "Password reset",
        description: data.tempPassword
          ? `New temporary password: ${data.tempPassword}`
          : "A new password has been generated.",
      });
    },
  });

  const onSubmit = (data: CreateStoreFormData) => {
    createStoreMutation.mutate(data);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">Monitor your virtual try-on platform performance</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-store">
              <Plus className="mr-2 h-4 w-4" />
              Add Store
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Store</DialogTitle>
              <DialogDescription>
                Set up a new store and assign a manager. They will receive a temporary password.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="manager@store.com"
                          data-testid="input-manager-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Fashion Boutique"
                          data-testid="input-store-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storeDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the store..."
                          data-testid="input-store-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createStoreMutation.isPending}
                    data-testid="button-submit-store"
                  >
                    {createStoreMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Store"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-24 mt-2" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Total Stores"
              value={stats?.totalStores ?? 0}
              icon={Building2}
              description="Active retail locations"
            />
            <StatCard
              title="API Calls"
              value={stats?.totalApiCalls ?? 0}
              icon={Activity}
              description="Try-on generations"
            />
            <StatCard
              title="Customer Sessions"
              value={stats?.totalSessions ?? 0}
              icon={Users}
              description="QR code scans"
            />
            <StatCard
              title="Clothing Items"
              value={stats?.totalClothingItems ?? 0}
              icon={ShoppingBag}
              description="Across all stores"
            />
          </>
        )}
      </div>

      {/* Stores List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Stores</h2>
          <Badge variant="secondary">{stores?.length ?? 0} total</Badge>
        </div>

        {storesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stores && stores.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                onToggleStatus={(id) => toggleStatusMutation.mutate(id)}
                onResetPassword={(id) => resetPasswordMutation.mutate(id)}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No stores yet</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-sm">
                Get started by creating your first store and assigning a manager.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Store
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
