import Mux from "@mux/mux-node";

const { MUX_TOKEN_ID, MUX_TOKEN_SECRET } = process.env;
if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
  throw new Error("Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET environment variable.");
}
const mux = new Mux({
  tokenId: MUX_TOKEN_ID,
  tokenSecret: MUX_TOKEN_SECRET,
});

export async function createLiveStream(readerId: number) {
  try {
    const stream = await mux.video.liveStreams.create({
      playback_policy: ["public"],
      new_asset_settings: { playback_policy: ["public"] },
      reconnect_window: 60,
      passthrough: `reader:${readerId}`,
    });
    return {
      streamKey: stream.stream_key,
      playbackId: stream.playback_ids?.[0]?.id || "",
    };
  } catch (err) {
    throw new Error("Failed to create Mux live stream: " + (err as any)?.message);
  }
}

export async function endLiveStream(streamKey: string) {
  try {
    // Find live stream by stream key
    const { data } = await mux.video.liveStreams.list({ limit: 100 });
    const live = data.find((s: any) => s.stream_key === streamKey);
    if (!live) throw new Error("Not found");
    await mux.video.liveStreams.disable(live.id);
    return true;
  } catch (err) {
    throw new Error("Failed to end Mux live stream: " + (err as any)?.message);
  }
}