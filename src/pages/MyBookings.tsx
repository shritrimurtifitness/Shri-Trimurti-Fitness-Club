import { useState } from "react";
import { Search, Calendar, Clock, MapPin, ArrowRight, History, ShieldCheck, Ticket } from "lucide-react";
import { format } from "date-fns";
import { formatTime12Hour } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import api from "@/lib/api";

export default function MyBookings() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ active: any[], history: any[] } | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/bookings/my-bookings/${phone}`);
      setData(res.data);
      setSearched(true);
    } catch (error) {
      toast.error("Failed to fetch bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const BookingCard = ({ booking }: { booking: any }) => (
    <Card className="overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-32 h-24 sm:h-auto relative overflow-hidden shrink-0">
          <img 
            src={booking.facility_image || "/placeholder-turf.jpg"} 
            alt={booking.facility_name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2 sm:hidden">
             <Badge className="bg-primary/90 text-[10px] uppercase">{booking.facility_type}</Badge>
          </div>
        </div>
        <CardContent className="p-4 flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="font-heading font-bold text-foreground text-lg leading-tight">
                {booking.facility_name} {booking.table_number > 1 ? `#${booking.table_number}` : ""}
              </h4>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-0.5 hidden sm:block">
                {booking.facility_type}
              </p>
            </div>
            <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'} className="capitalize">
              {booking.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-y-3 gap-x-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 text-primary" />
              <span>{format(new Date(booking.date), "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-primary" />
              <span>{formatTime12Hour(booking.start_time)} - {formatTime12Hour(booking.end_time)}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-muted-foreground">Payment:</span>
              <span className={booking.payment_status === 'paid' ? 'text-emerald-500' : 'text-amber-500'}>
                {booking.payment_status === 'paid' ? (
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Full Paid</span>
                ) : (
                  `Pending ₹${booking.remaining_amount}`
                )}
              </span>
            </div>
            <p className="text-sm font-bold text-foreground">₹{booking.total_amount}</p>
          </div>
        </CardContent>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen pt-24 pb-20 bg-background">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-10">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 px-3 py-1">
            Booking History
          </Badge>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4 tracking-tight">
             My <span className="text-gradient-turf">Arena Records</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Review your upcoming slots and past game history by entering your registered contact number.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-12">
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <Input
              type="tel"
              placeholder="Enter your 10-digit phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="pl-12 pr-32 h-14 rounded-2xl border-2 border-border bg-card shadow-lg focus-visible:ring-0 focus-visible:border-primary transition-all text-lg font-medium"
            />
            <Button 
              type="submit" 
              disabled={loading || phone.length < 10}
              className="absolute right-2 top-2 bottom-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6"
            >
              {loading ? "Searching..." : "Track"}
            </Button>
          </form>
        </div>

        {searched && data && (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] mx-auto mb-8 h-12 p-1.5 rounded-xl bg-card border border-border">
              <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Upcoming ({data.active.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                 History ({data.history.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4 outline-none">
              {data.active.length > 0 ? (
                data.active.map(b => <BookingCard key={b.id} booking={b} />)
              ) : (
                <div className="text-center py-20 bg-card/50 rounded-3xl border-2 border-dashed border-border p-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Ticket className="w-8 h-8 text-primary opacity-40" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No active slots found</h3>
                  <p className="text-muted-foreground mb-8 text-sm max-w-xs mx-auto">
                    You don't have any upcoming bookings. Ready for a game?
                  </p>
                  <Link to="/">
                    <Button className="bg-primary text-primary-foreground rounded-xl h-12 px-8 font-bold">
                      Book a Slot Now <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4 outline-none">
              {data.history.length > 0 ? (
                data.history.map(b => <BookingCard key={b.id} booking={b} />)
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <History className="w-10 h-10 mx-auto mb-4 opacity-10" />
                  <p>No past booking history found for this number.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
