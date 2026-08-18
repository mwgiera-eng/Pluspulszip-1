import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TrustDock } from "@/components/TrustDock";
import { Loader2, Crown, Lock } from "lucide-react";
import { Link, useLocation } from "wouter";
import Dashboard from "@/pages/Dashboard";
import Earnings from "@/pages/Earnings";
import MapPage from "@/pages/MapPage";
import Settings from "@/pages/Settings";
import Subscription from "@/pages/Subscription";
import Login, { Register } from "@/pages/Login";
import AdminLogin from "@/pages/AdminLogin";
import Pending from "@/pages/Pending";
import NotFound from "@/pages/not-found";
import Notifications from "@/pages/Notifications";
import Admin from "@/pages/Admin";
import DayPlanner from "@/pages/DayPlanner";
import AccountTypeSetup from "@/pages/AccountTypeSetup";
import { TrustCenter } from "@/pages/TrustCenter";
import AccountDeletion from "@/pages/AccountDeletion";

function Loading(){return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary"/></div>}
function PublicBanner(){return <div className="w-full bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap" data-testid="banner-public"><p className="text-xs text-primary font-medium">Przeglądasz +Puls w trybie publicznym — mapa i strefy są dostępne.</p><Link href="/register"><button className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md font-semibold">Utwórz konto</button></Link></div>}
function PublicRoute({component:Component}:{component:React.ComponentType<any>}){const{user,isLoading}=useAuth();if(isLoading)return <Loading/>;if(user?.status==="pending")return <Pending/>;if(user&&["rejected","disabled","suspended"].includes(user.status??""))return <Login initialMode="login"/>;if(user&&(user.status==="approved"||user.status==="active"||user.role==="admin"))return <Component/>;return <Component isPublic publicBanner={<PublicBanner/>}/>}
function ProtectedRoute({component:Component}:{component:React.ComponentType<any>}){const{user,isLoading}=useAuth();useHeartbeat(!!(user&&(user.status==="approved"||user.status==="active")));if(isLoading)return <Loading/>;if(!user)return <Login initialMode="login"/>;if(user.status==="pending")return <Pending/>;if(["rejected","disabled","suspended"].includes(user.status??""))return <Login initialMode="login"/>;if(!user.accountType&&user.role!=="admin")return <AccountTypeSetup/>;return <Component/>}
function AdminRoute(){const{user,isLoading}=useAuth();if(isLoading)return <Loading/>;if(!user||user.role!=="admin"||user.status!=="approved")return <AdminLogin/>;return <Admin/>}
function PremiumGate(){const{subscriptionInfo}=useAuth();const[,setLocation]=useLocation();return <div className="flex h-screen items-center justify-center bg-background p-6"><div className="w-full max-w-md text-center space-y-5"><div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"><Lock className="w-8 h-8 text-primary"/></div><h1 className="text-2xl font-bold">Premium Feature</h1><p className="text-muted-foreground text-sm">{subscriptionInfo?.status==="expired"?"Your free trial has ended. Subscribe to unlock all premium features.":"This feature requires a premium subscription."}</p><button onClick={()=>setLocation("/subscription")} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium"><Crown className="w-4 h-4"/>Upgrade to Premium - 9.99 PLN/month</button></div></div>}
function PremiumRoute({component:Component}:{component:React.ComponentType<any>}){const{isPremium}=useAuth();return <ProtectedRoute component={isPremium?Component:()=> <PremiumGate/>}/>}

function Router(){return <Switch>
<Route path="/login">{()=> <Login initialMode="login"/>}</Route>
<Route path="/register" component={Register}/>
<Route path="/pending" component={Pending}/>
<Route path="/admin/login" component={AdminLogin}/>
<Route path="/trust/accessibility"><TrustCenter section="accessibility"/></Route>
<Route path="/trust/privacy"><TrustCenter section="privacy"/></Route>
<Route path="/trust/cookies"><TrustCenter section="cookies"/></Route>
<Route path="/trust/terms"><TrustCenter section="terms"/></Route>
<Route path="/trust/code-of-conduct"><TrustCenter section="conduct"/></Route>
<Route path="/trust/modern-slavery"><TrustCenter section="modern-slavery"/></Route>
<Route path="/trust/speak-up"><TrustCenter section="speak-up"/></Route>
<Route path="/trust/company"><TrustCenter section="company"/></Route>
<Route path="/account-deletion" component={AccountDeletion}/>
<Route path="/"><PublicRoute component={Dashboard}/></Route>
<Route path="/map"><PublicRoute component={MapPage}/></Route>
<Route path="/planner"><PremiumRoute component={DayPlanner}/></Route>
<Route path="/earnings"><PremiumRoute component={Earnings}/></Route>
<Route path="/notifications"><PremiumRoute component={Notifications}/></Route>
<Route path="/settings"><ProtectedRoute component={Settings}/></Route>
<Route path="/subscription"><ProtectedRoute component={Subscription}/></Route>
<Route path="/admin" component={AdminRoute}/>
<Route component={NotFound}/>
</Switch>}
function NotificationRunner(){usePushNotifications();return null}
function App(){return <QueryClientProvider client={queryClient}><TooltipProvider><Toaster/><Router/><BottomNav/><InstallPrompt/><TrustDock/><NotificationRunner/></TooltipProvider></QueryClientProvider>}
export default App;
