import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Camera,
  Upload,
  Sparkles,
  Filter,
  ScanBarcode,
  Clock,
  Check,
  X,
  Loader2,
  Download,
  RefreshCw,
  Package,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
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

interface TryOnResult {
  clothingItem: ClothingItem;
  resultImageUrl: string;
}

function SessionTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "warning" | "urgent">("normal");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Expired");
        setUrgency("urgent");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);

      if (minutes < 5) {
        setUrgency("urgent");
      } else if (minutes < 15) {
        setUrgency("warning");
      } else {
        setUrgency("normal");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <Badge
      variant={urgency === "urgent" ? "destructive" : urgency === "warning" ? "secondary" : "outline"}
      className="gap-1"
      data-testid="badge-session-timer"
    >
      <Clock className="h-3 w-3" />
      {timeLeft}
    </Badge>
  );
}

function ClothingCard({
  item,
  isSelected,
  onToggle,
}: {
  item: ClothingItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover-elevate overflow-visible ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      onClick={onToggle}
      data-testid={`card-clothing-${item.id}`}
    >
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
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </AspectRatio>
        {isSelected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
            <Check className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </div>
      <CardContent className="p-2">
        <h3 className="text-sm font-medium truncate">{item.name}</h3>
        <Badge variant="outline" className="text-xs mt-1 capitalize">
          {item.category}
        </Badge>
      </CardContent>
    </Card>
  );
}

export default function CustomerTryOn() {
  const { toast } = useToast();
  const { customerSession, setCustomerSession } = useAuth();
  const [step, setStep] = useState<"upload" | "select" | "generating" | "results">("upload");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userPhotoFile, setUserPhotoFile] = useState<File | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [results, setResults] = useState<TryOnResult[]>([]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: items, isLoading: itemsLoading } = useQuery<ClothingItem[]>({
    queryKey: ["/api/customer/clothes", customerSession?.storeId, selectedCategory],
    queryFn: async () => {
      const url = selectedCategory === "all"
        ? `/api/customer/clothes?storeId=${customerSession?.storeId}`
        : `/api/customer/clothes?storeId=${customerSession?.storeId}&category=${selectedCategory}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
    enabled: !!customerSession?.storeId,
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("sessionId", customerSession?.id || "");

      const res = await fetch("/api/customer/upload-photo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to upload photo");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setUserPhoto(data.photoUrl);
      setStep("select");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload photo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const tryOnMutation = useMutation({
    mutationFn: async () => {
      const itemIds = Array.from(selectedItems);
      const results: TryOnResult[] = [];

      for (let i = 0; i < itemIds.length; i++) {
        setGenerationProgress(((i + 1) / itemIds.length) * 100);

        const res = await fetch("/api/tryon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: customerSession?.id,
            clothingItemId: itemIds[i],
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || `Failed to generate try-on for item ${i + 1}`);
        }

        const data = await res.json();
        const item = items?.find((item) => item.id === itemIds[i]);
        if (item) {
          results.push({
            clothingItem: item,
            resultImageUrl: data.resultImageUrl,
          });
        }
      }

      return results;
    },
    onSuccess: (data) => {
      setResults(data);
      setStep("results");
    },
    onError: (error: Error) => {
      toast({
        title: "Try-on failed",
        description: error.message,
        variant: "destructive",
      });
      setStep("select");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUserPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
      uploadPhotoMutation.mutate(file);
    }
  };

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;

    const item = items?.find((i) => i.barcode === barcodeInput.trim());
    if (item) {
      setSelectedItems((prev) => {
        const newSet = new Set(prev);
        newSet.add(item.id);
        return newSet;
      });
      toast({
        title: "Item found",
        description: `"${item.name}" has been selected.`,
      });
      setBarcodeInput("");
      setIsBarcodeDialogOpen(false);
    } else {
      toast({
        title: "Item not found",
        description: "No item matches this barcode.",
        variant: "destructive",
      });
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const startTryOn = () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to try on.",
        variant: "destructive",
      });
      return;
    }
    setStep("generating");
    setGenerationProgress(0);
    tryOnMutation.mutate();
  };

  const reset = () => {
    setStep("upload");
    setUserPhoto(null);
    setUserPhotoFile(null);
    setSelectedItems(new Set());
    setResults([]);
    setGenerationProgress(0);
  };

  const downloadResult = (result: TryOnResult) => {
    const link = document.createElement("a");
    link.download = `tryon-${result.clothingItem.name}.png`;
    link.href = result.resultImageUrl;
    link.click();
  };

  if (!customerSession) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="flex items-center justify-between p-4 md:p-6 border-b">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">StyleMirror</span>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ScanBarcode className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Active Session</h2>
              <p className="text-muted-foreground text-center mb-4">
                Please scan a QR code at the store to start your virtual try-on session.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 md:p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold">{customerSession.storeName}</h1>
            <p className="text-xs text-muted-foreground">Virtual Try-On</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SessionTimer expiresAt={customerSession.expiresAt} />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1">
        {/* Step 1: Upload Photo */}
        {step === "upload" && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
            <div className="max-w-md w-full text-center">
              <div className="relative mx-auto mb-8">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
                  <Camera className="h-16 w-16 text-primary" />
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-bold mb-3">Upload Your Photo</h2>
              <p className="text-muted-foreground mb-8">
                Take a full-body photo or upload one to see how clothes look on you
              </p>

              <div
                className="border-2 border-dashed rounded-xl p-8 mb-6 cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadPhotoMutation.isPending ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Uploading your photo...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-user-photo"
                />
              </div>

              <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                <span>Your photo is automatically deleted after your session ends</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Clothes */}
        {step === "select" && (
          <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setStep("upload")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-xl font-semibold">Select Clothes</h2>
                  <p className="text-sm text-muted-foreground">
                    Choose items you want to try on
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsBarcodeDialogOpen(true)}
                  data-testid="button-scan-barcode"
                >
                  <ScanBarcode className="mr-2 h-4 w-4" />
                  Scan Barcode
                </Button>
                <Button
                  onClick={startTryOn}
                  disabled={selectedItems.size === 0}
                  data-testid="button-start-tryon"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Try On ({selectedItems.size})
                </Button>
              </div>
            </div>

            {/* User Photo Preview */}
            {userPhoto && (
              <Card className="max-w-xs mx-auto">
                <CardContent className="p-3">
                  <AspectRatio ratio={3 / 4}>
                    <img
                      src={userPhoto}
                      alt="Your photo"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </AspectRatio>
                </CardContent>
              </Card>
            )}

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
              >
                All
              </Button>
              {clothingCategories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="capitalize"
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* Clothing Grid */}
            {itemsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <Skeleton className="aspect-[3/4] rounded-t-lg" />
                    <CardContent className="p-2">
                      <Skeleton className="h-4 w-20 mb-1" />
                      <Skeleton className="h-5 w-12" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : items && items.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.filter((item) => item.isAvailable).map((item) => (
                  <ClothingCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItems.has(item.id)}
                    onToggle={() => toggleItemSelection(item.id)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No items available</h3>
                  <p className="text-muted-foreground text-center">
                    There are no clothing items available for try-on at this moment.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 3: Generating */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
            <div className="max-w-md w-full text-center">
              <div className="relative mx-auto mb-8">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
                  <Sparkles className="h-12 w-12 text-primary" />
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-3">Creating Your Look</h2>
              <p className="text-muted-foreground mb-8">
                Our AI is generating your virtual try-on images...
              </p>

              <div className="max-w-xs mx-auto">
                <Progress value={generationProgress} className="h-2 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {Math.round(generationProgress)}% complete
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === "results" && (
          <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Your Try-On Results</h2>
                <p className="text-sm text-muted-foreground">
                  {results.length} outfit{results.length !== 1 ? "s" : ""} generated
                </p>
              </div>
              <Button onClick={reset} data-testid="button-try-another">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Another
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {results.map((result, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">{result.clothingItem.name}</h3>
                      <Badge variant="outline" className="capitalize">
                        {result.clothingItem.category}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Original</p>
                        <AspectRatio ratio={3 / 4}>
                          <img
                            src={userPhoto || ""}
                            alt="Original"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </AspectRatio>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Try-On Result</p>
                        <AspectRatio ratio={3 / 4}>
                          <img
                            src={result.resultImageUrl}
                            alt="Try-on result"
                            className="w-full h-full object-cover rounded-lg"
                            data-testid={`img-result-${index}`}
                          />
                        </AspectRatio>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-3"
                      onClick={() => downloadResult(result)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Barcode Dialog */}
      <Dialog open={isBarcodeDialogOpen} onOpenChange={setIsBarcodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
            <DialogDescription>
              Enter the barcode of the clothing item to quickly find it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Enter barcode..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBarcodeSearch()}
              data-testid="input-barcode-search"
            />
            <Button onClick={handleBarcodeSearch} data-testid="button-search-barcode">
              Search
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
