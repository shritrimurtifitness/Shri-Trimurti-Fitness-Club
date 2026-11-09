import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Upload, Image as LucideImage, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import api from "@/lib/api";

interface GalleryImage {
  id: string;
  cloudinary_url: string;
  public_id: string;
  alt_text: string;
  span_type: string;
  sort_order: number;
  resource_type: 'image' | 'video';
}

export default function AdminGallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [spanType, setSpanType] = useState("default");
  const [sortOrder, setSortOrder] = useState("0");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = async () => {
    try {
      const res = await api.get("/gallery");
      setImages(res.data);
    } catch { toast.error("Failed to load gallery images"); }
  };

  useEffect(() => { fetchImages(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAltText("");
    setSpanType("default");
    setSortOrder("0");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) return toast.error("Please select a file first");
    
    const isVideo = selectedFile.type.startsWith('video');
    if (isVideo && selectedFile.size > 20 * 1024 * 1024) {
      return toast.error("Video size must be less than 20MB");
    }
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("alt_text", altText);
    formData.append("span_type", spanType);
    formData.append("sort_order", sortOrder);

    try {
      await api.post("/gallery", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(isVideo ? "Video uploaded successfully!" : "Image uploaded successfully!");
      setIsOpen(false);
      resetForm();
      fetchImages();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    toast("Delete this image from gallery and Cloudinary?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/gallery/${id}`);
            toast.success("Image deleted");
            fetchImages();
          } catch {
            toast.error("Failed to delete image");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const updateImageInfo = async (id: string, info: Partial<GalleryImage>) => {
    try {
      await api.patch(`/gallery/${id}`, info);
      toast.success("Information updated");
      fetchImages();
    } catch { toast.error("Failed to update"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Gallery Manager</h2>
          <p className="text-sm text-muted-foreground">Manage landing page images via Cloudinary</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="bg-gradient-turf text-primary-foreground shadow-turf">
          <Plus className="w-4 h-4 mr-2" /> Add Media
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((img) => (
          <div key={img.id} className="group relative rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30">
            <div className="aspect-square overflow-hidden bg-muted relative">
              {img.resource_type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-black">
                  <video src={img.cloudinary_url} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <div className="ml-0.5 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent" />
                    </div>
                  </div>
                </div>
              ) : (
                <img src={img.cloudinary_url} alt={img.alt_text} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              )}
            </div>
            
            <div className="p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {img.resource_type === 'video' ? 'Video' : (img.span_type === 'large' ? 'Large Card' : 'Image')}
                </span>
                <div className="flex gap-1">
                  <a href={img.cloudinary_url} target="_blank" rel="noreferrer" className="p-1 text-muted-foreground hover:text-primary">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => handleDelete(img.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <select 
                  className="w-full bg-transparent text-xs border border-border rounded px-1.5 py-1"
                  value={img.span_type}
                  onChange={(e) => updateImageInfo(img.id, { span_type: e.target.value })}
                >
                  <option value="default">Small Aspect</option>
                  <option value="large">Large (Bento Multi-Span)</option>
                </select>
                <input 
                  type="number" 
                  className="w-full bg-transparent text-xs border border-border rounded px-1.5 py-1"
                  value={img.sort_order}
                  onChange={(e) => updateImageInfo(img.id, { sort_order: Number(e.target.value) })}
                  placeholder="Order"
                />
              </div>
            </div>
          </div>
        ))}

        {images.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-border rounded-xl py-20 flex flex-col items-center justify-center text-muted-foreground">
            <LucideImage className="w-10 h-10 mb-3 opacity-20" />
            <p>No gallery images yet. Start uploading!</p>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={isOpen} onOpenChange={(val) => { if (!val && !isUploading) setIsOpen(false); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Upload Gallery Image</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative cursor-pointer border-2 border-dashed border-border rounded-xl aspect-video flex flex-col items-center justify-center hover:border-primary/50 transition-colors bg-muted/30 overflow-hidden"
            >
              {previewUrl ? (
                <div className="w-full h-full relative">
                  {selectedFile?.type.startsWith('video') ? (
                    <video src={previewUrl} className="w-full h-full object-cover" controls={false} muted />
                  ) : (
                    <img src={previewUrl} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <p className="text-white text-sm font-medium">Change File</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary" />
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Click to select file</p>
                  <p className="text-xs text-muted-foreground/60">JPG, PNG, MP4 or WEBM</p>
                </>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Alt Text (SEO)</Label>
                <Input value={altText} onChange={e => setAltText(e.target.value)} placeholder="e.g. Indoor cricket practice nets" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Grid Layout</Label>
                  <Select value={spanType} onValueChange={setSpanType}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Standard Square</SelectItem>
                      <SelectItem value="large">Large Bento (2x2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sort Order</Label>
                  <Input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }} disabled={isUploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={isUploading || !selectedFile} className="bg-gradient-turf text-primary-foreground shadow-turf">
              {isUploading ? "Uploading..." : "Publish to Gallery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
