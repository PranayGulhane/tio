import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ShoppingBag,
  Plus,
  QrCode,
  Trash2,
  Edit,
  Upload,
  Loader2,
  Package,
  Eye,
  EyeOff,
  Download,
  Copy,
  Timer,
  Activity,
  Users,
  X,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { ClothingItem, ClothingCategory } from "@shared/schema";

const clothingCategories: ClothingCategory[] = [
  "shirts",
  "pants",
  "jackets",
  "dresses",
  "skirts",
  "accessories",
  "shoes",
  "other",
];

const createClothingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.enum(clothingCategories as [ClothingCategory, ...ClothingCategory[]]),
  barcode: z.string().optional(),
  isAvailable: z.boolean().default(true),
});

type CreateClothingFormData = z.infer<typeof createClothingSchema>;

interface StoreStats {
  clothingCount: number;
  tryOnCount: number;
  sessionCount: number;
  availableCount: number;
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: typeof ShoppingBag;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ClothingItemCard({
  item,
  onEdit,
  onDelete,
  onToggleAvailability,
}: {
  item: ClothingItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: () => void;
}) {
  return (
    <Card className="group hover-elevate overflow-visible">
      <div className="relative">
        <AspectRatio ratio={3 / 4}>
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover rounded-t-lg"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center rounded-t-lg">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </AspectRatio>
        <div className="absolute top-2 right-2">
          <Badge variant={item.isAvailable ? "default" : "secondary"}>
            {item.isAvailable ? "Available" : "Unavailable"}
          </Badge>
        </div>
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-t-lg">
          <Button size="icon" variant="secondary" onClick={onEdit} data-testid={`button-edit-${item.id}`}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" onClick={onToggleAvailability}>
            {item.isAvailable ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="destructive" onClick={onDelete} data-testid={`button-delete-${item.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardContent className="p-3">
        <h3 className="font-semibold text-sm truncate" data-testid={`text-item-name-${item.id}`}>
          {item.name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <Badge variant="outline" className="text-xs capitalize">
            {item.category}
          </Badge>
          {item.barcode && (
            <span className="text-xs text-muted-foreground font-mono">
              {item.barcode}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {item.tryOnCount} try-ons
        </div>
      </CardContent>
    </Card>
  );
}

function QRCodeDialog({ storeId }: { storeId: string }) {
  const { toast } = useToast();
  const [qrData, setQrData] = useState<{ qrCode: string; token: string; expiresAt: string } | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/store/qr/generate", {});
    },
    onSuccess: (data: { qrCode: string; token: string; expiresAt: string }) => {
      setQrData(data);
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate QR code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyLink = () => {
    if (qrData) {
      const link = `${window.location.origin}/?session=${qrData.token}`;
      navigator.clipboard.writeText(link);
      toast({
        title: "Link copied",
        description: "Customer access link has been copied to clipboard.",
      });
    }
  };

  const downloadQR = () => {
    if (qrData) {
      const link = document.createElement("a");
      link.download = "virtual-tryon-qr.png";
      link.href = qrData.qrCode;
      link.click();
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button data-testid="button-generate-qr">
          <QrCode className="mr-2 h-4 w-4" />
          Generate QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Access QR Code</DialogTitle>
          <DialogDescription>
            Customers can scan this code to start a 1-hour try-on session.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {qrData ? (
            <>
              <div className="p-4 bg-white rounded-lg">
                <img
                  src={qrData.qrCode}
                  alt="QR Code"
                  className="w-48 h-48"
                  data-testid="img-qr-code"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Timer className="h-4 w-4" />
                <span>Expires: {new Date(qrData.expiresAt).toLocaleString()}</span>
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={copyLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button variant="outline" className="flex-1" onClick={downloadQR}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-48 h-48 border-2 border-dashed rounded-lg flex items-center justify-center">
                <QrCode className="h-16 w-16 text-muted-foreground" />
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-create-qr"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Generate New QR Code
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ManagerDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateClothingFormData>({
    resolver: zodResolver(createClothingSchema),
    defaultValues: {
      name: "",
      category: "shirts",
      barcode: "",
      isAvailable: true,
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<StoreStats>({
    queryKey: ["/api/store/stats"],
  });

  const { data: items, isLoading: itemsLoading } = useQuery<ClothingItem[]>({
    queryKey: ["/api/store/items", selectedCategory],
    queryFn: async () => {
      const url = selectedCategory === "all"
        ? "/api/store/items"
        : `/api/store/items?category=${selectedCategory}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const createItemMutation = useMutation({
    mutationFn: async (data: CreateClothingFormData) => {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("category", data.category);
      formData.append("barcode", data.barcode || "");
      formData.append("isAvailable", String(data.isAvailable));
      if (uploadedImage) {
        formData.append("image", uploadedImage);
      }

      const res = await fetch("/api/store/items", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create item");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setUploadedImage(null);
      setImagePreview(null);
      toast({
        title: "Item created",
        description: "The clothing item has been added to your inventory.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateClothingFormData }) => {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("category", data.category);
      formData.append("barcode", data.barcode || "");
      formData.append("isAvailable", String(data.isAvailable));
      if (uploadedImage) {
        formData.append("image", uploadedImage);
      }

      const res = await fetch(`/api/store/items/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update item");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/items"] });
      setEditingItem(null);
      form.reset();
      setUploadedImage(null);
      setImagePreview(null);
      toast({
        title: "Item updated",
        description: "The clothing item has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/store/items/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });
      toast({
        title: "Item deleted",
        description: "The clothing item has been removed.",
      });
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/store/items/${id}/toggle-availability`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/store/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/stats"] });
    },
  });

  const openEditDialog = (item: ClothingItem) => {
    setEditingItem(item);
    form.reset({
      name: item.name,
      category: item.category as ClothingCategory,
      barcode: item.barcode || "",
      isAvailable: item.isAvailable ?? true,
    });
    setImagePreview(item.imageUrl);
  };

  const closeDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingItem(null);
    form.reset();
    setUploadedImage(null);
    setImagePreview(null);
  };

  const onSubmit = (data: CreateClothingFormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{user?.storeName || "Store Dashboard"}</h1>
          <p className="text-muted-foreground mt-1">Manage your clothing inventory and customer sessions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <QRCodeDialog storeId={user?.storeId || ""} />
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-item">
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard title="Total Items" value={stats?.clothingCount ?? 0} icon={ShoppingBag} />
            <StatCard title="Available" value={stats?.availableCount ?? 0} icon={Package} />
            <StatCard title="Try-ons" value={stats?.tryOnCount ?? 0} icon={Activity} />
            <StatCard title="Sessions" value={stats?.sessionCount ?? 0} icon={Users} />
          </>
        )}
      </div>

      {/* Inventory */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">Inventory</h2>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              {clothingCategories.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {itemsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <Skeleton className="aspect-[3/4] rounded-t-lg" />
                <CardContent className="p-3">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-5 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => (
              <ClothingItemCard
                key={item.id}
                item={item}
                onEdit={() => openEditDialog(item)}
                onDelete={() => deleteItemMutation.mutate(item.id)}
                onToggleAvailability={() => toggleAvailabilityMutation.mutate(item.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No items yet</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-sm">
                Start by adding clothing items to your inventory for customers to try on.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Item
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || !!editingItem} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the clothing item details."
                : "Add a new clothing item to your inventory."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Image Upload */}
              <div>
                <FormLabel>Image</FormLabel>
                <div
                  className="mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-40 mx-auto rounded-lg"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagePreview(null);
                          setUploadedImage(null);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG up to 10MB
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    data-testid="input-image-upload"
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Blue Cotton Shirt" data-testid="input-item-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clothingCategories.map((cat) => (
                          <SelectItem key={cat} value={cat} className="capitalize">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="1234567890" data-testid="input-barcode" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isAvailable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Available for try-on</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-availability"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createItemMutation.isPending || updateItemMutation.isPending}
                  data-testid="button-submit-item"
                >
                  {(createItemMutation.isPending || updateItemMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingItem ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingItem ? "Update Item" : "Add Item"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
