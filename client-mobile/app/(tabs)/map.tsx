import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapExperience } from "@/components/MapExperience";
import { NextMoveCard } from "@/components/NextMoveCard";
import { useDeviceLocation } from "@/hooks/use-device-location";
import { useLiveHeat } from "@/hooks/use-live-heat";
import { theme } from "@/lib/theme";

const OFFSETS = [0, 3, 6, 12] as const;

export default function MapScreen() {
  const [hoursAhead, setHoursAhead] = useState<(typeof OFFSETS)[number]>(0);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showHeat, setShowHeat] = useState(true);
  const { data, error, loading, refresh } = useLiveHeat(hoursAhead);
  const { position, status } = useDeviceLocation();
  const cells = data?.cells ?? [];
  const score = useMemo(
    () => Math.round(cells.slice(0, 40).reduce((sum, cell) => sum + cell.score, 0) / Math.max(1, Math.min(cells.length, 40))),
    [cells],
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.liveDot} />
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{status === "active" ? "GPS Active" : status === "requesting" ? "GPS Locking" : "Kraków Grid"}</Text>
          <Text style={styles.headerMeta}>{status === "denied" ? "Lokalizacja wyłączona · centrum Krakowa" : "Live demand · Kraków"}</Text>
        </View>
        <Pressable onPress={refresh} style={styles.refresh} accessibilityLabel="Odśwież dane mapy"><Ionicons name="refresh" size={18} color={theme.primary} /></Pressable>
      </View>

      <View style={styles.map}>
        <MapExperience cells={cells} position={position} showTraffic={showTraffic} showHeat={showHeat} />

        <View style={styles.layers}>
          <Pressable onPress={() => setShowTraffic((v) => !v)} style={[styles.layer, showTraffic && styles.layerActive]}>
            <Ionicons name="pulse-outline" size={14} color={showTraffic ? theme.background : theme.muted} />
            <Text style={[styles.layerText, showTraffic && styles.layerTextActive]}>Ruch</Text>
          </Pressable>
          <Pressable onPress={() => setShowHeat((v) => !v)} style={[styles.layer, showHeat && styles.layerActive]}>
            <Ionicons name="flame-outline" size={14} color={showHeat ? theme.background : theme.muted} />
            <Text style={[styles.layerText, showHeat && styles.layerTextActive]}>Heat</Text>
          </Pressable>
        </View>

        <View style={styles.offsets}>{OFFSETS.map((offset) => (
          <Pressable key={offset} onPress={() => setHoursAhead(offset)} style={[styles.offset, hoursAhead === offset && styles.offsetActive]}>
            <Text style={[styles.offsetText, hoursAhead === offset && styles.offsetTextActive]}>{offset === 0 ? "LIVE" : `+${offset}h`}</Text>
          </Pressable>
        ))}</View>

        {loading && !data ? <View style={styles.centerState}><ActivityIndicator color={theme.primary} size="large" /><Text style={styles.stateText}>Ładowanie siatki…</Text></View> : null}
        {error && !data ? <View style={styles.centerState}><Text style={styles.errorTitle}>Brak danych mapy</Text><Text style={styles.stateText}>{error}</Text><Pressable onPress={refresh} style={styles.retry}><Text style={styles.retryText}>Spróbuj ponownie</Text></Pressable></View> : null}
        <View style={styles.cardWrap}><NextMoveCard score={score || 72} onRefresh={refresh} /></View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:theme.background},header:{minHeight:68,paddingHorizontal:16,flexDirection:"row",alignItems:"center",gap:11,backgroundColor:theme.background},liveDot:{width:10,height:10,borderRadius:5,backgroundColor:theme.primary,shadowColor:theme.primary,shadowOpacity:1,shadowRadius:10,elevation:8},headerCopy:{flex:1},headerTitle:{color:theme.text,fontSize:18,fontWeight:"900"},headerMeta:{color:theme.muted,fontSize:10,marginTop:2,fontWeight:"600"},refresh:{width:38,height:38,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border},map:{flex:1,position:"relative"},offsets:{position:"absolute",top:12,alignSelf:"center",flexDirection:"row",gap:4,padding:4,borderRadius:99,backgroundColor:"rgba(10,13,20,0.88)",borderWidth:1,borderColor:"rgba(46,230,166,0.25)"},offset:{borderRadius:99,paddingHorizontal:9,paddingVertical:6},offsetActive:{backgroundColor:theme.primary},offsetText:{color:theme.muted,fontSize:10,fontWeight:"900"},offsetTextActive:{color:theme.background},layers:{position:"absolute",right:10,top:54,gap:6},layer:{minWidth:70,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,paddingHorizontal:10,paddingVertical:8,borderRadius:12,backgroundColor:"rgba(10,13,20,0.84)",borderWidth:1,borderColor:theme.border},layerActive:{backgroundColor:theme.primary,borderColor:theme.primary},layerText:{color:theme.muted,fontSize:10,fontWeight:"900"},layerTextActive:{color:theme.background},cardWrap:{position:"absolute",left:12,right:12,bottom:12},centerState:{position:"absolute",top:"35%",alignSelf:"center",maxWidth:280,alignItems:"center",backgroundColor:"rgba(10,13,20,0.94)",borderRadius:18,padding:20,borderWidth:1,borderColor:theme.border},stateText:{color:theme.muted,textAlign:"center",marginTop:10,fontSize:12},errorTitle:{color:theme.danger,fontWeight:"900",fontSize:16},retry:{backgroundColor:theme.primary,borderRadius:12,marginTop:14,paddingHorizontal:16,paddingVertical:10},retryText:{color:theme.background,fontWeight:"900"}
});
