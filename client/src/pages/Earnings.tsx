import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUploadEarnings, useEarningsStats, useEarnings } from "@/hooks/use-earnings";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Earnings() {
  const { mutate: upload, isPending } = useUploadEarnings();
  const { data: stats } = useEarningsStats();
  const { data: recentEarnings } = useEarnings();
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (file: File) => {
    if (file.type !== "text/csv") {
      toast({ title: "Invalid file", description: "Please upload a CSV file.", variant: "destructive" });
      return;
    }
    
    upload(file, {
      onSuccess: (data) => {
        toast({ 
          title: "Upload Complete", 
          description: `Processed ${data.processed} records. ${data.failed} failed.`,
          variant: "default" 
        });
      },
      onError: (err) => {
        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
          
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Earnings Analytics</h2>
              <p className="text-muted-foreground mt-1">Upload CSVs to analyze your performance.</p>
            </div>
          </div>

          {/* Upload Area */}
          <div 
            className={`
              relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200
              ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}
            `}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-secondary rounded-full">
                {isPending ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <Upload className="w-8 h-8 text-primary" />}
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Upload Earnings CSV</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Drag and drop your ride-hailing platform CSV export here, or click to select file.
                  We analyze it locally to identify your best zones.
                </p>
              </div>
              <div className="relative">
                <Button disabled={isPending} className="relative z-10">
                  Select CSV File
                </Button>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Zones Chart */}
            <Card className="col-span-2 border-border shadow-lg">
              <CardHeader>
                <CardTitle>Top Performing Zones</CardTitle>
                <CardDescription>Where you make the most money</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {stats?.topZones ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topZones} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                      <XAxis type="number" stroke="#666" fontSize={12} unit=" zł" />
                      <YAxis dataKey="name" type="category" stroke="#999" fontSize={12} width={100} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1b1e', borderColor: '#333' }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data available yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <Card className="border-border shadow-lg">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold text-primary">{stats?.totalEarnings || 0} PLN</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Trips Analyzed</p>
                  <p className="text-2xl font-bold">{stats?.totalTrips || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average / Trip</p>
                  <p className="text-2xl font-bold">{stats?.averagePerTrip.toFixed(2) || 0} PLN</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent History */}
          <Card className="border-border shadow-lg">
            <CardHeader>
              <CardTitle>Recent Trips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentEarnings?.slice(0, 5).map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-background rounded-md border border-border">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{format(new Date(trip.tripDate), 'MMM d, yyyy • HH:mm')}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{trip.pickupAddress || 'Unknown location'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{trip.amount} PLN</p>
                      <p className="text-xs text-muted-foreground">{trip.distanceKm} km</p>
                    </div>
                  </div>
                ))}
                {!recentEarnings?.length && (
                  <div className="text-center py-8 text-muted-foreground">
                    Upload your first CSV to see trip history.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
