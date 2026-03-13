<template>
  <div class="card h-100 border-0 bg-transparent">
    <div class="card-body p-2">
      <h3 class="mb-2">PluginAPI Reference Hello World (All Features + Click Event Deep Dive)</h3>

      <div class="d-flex flex-wrap gap-2 mb-3">
        <button class="btn btn-sm btn-primary" @click="refreshFeatureList" :disabled="busy.list">
          {{ busy.list ? 'Loading…' : 'feature.list()' }}
        </button>

        <button class="btn btn-sm btn-outline-primary" @click="toggleFeatureStream">
          {{ stream.active ? 'Stop feature.stream()' : 'Start feature.stream()' }}
        </button>

        <button class="btn btn-sm btn-outline-success" @click="ensureMapDemo">
          Ensure map demo layer
        </button>

        <button class="btn btn-sm btn-outline-danger" @click="removeMapDemo">
          Remove map demo layer
        </button>

        <button class="btn btn-sm btn-outline-success" @click="attachClickHandler" :disabled="click.attached">
          Attach onClick
        </button>

        <button class="btn btn-sm btn-outline-danger" @click="detachClickHandler" :disabled="!click.attached">
          Detach onClick
        </button>

        <button class="btn btn-sm btn-outline-secondary" @click="openFloatingPane">
          Open floating pane
        </button>

        <button class="btn btn-sm btn-outline-secondary" @click="closeFloatingPane" :disabled="!float.has">
          Close floating pane
        </button>

        <button class="btn btn-sm btn-outline-secondary" @click="clearClick">
          Clear click
        </button>
      </div>

      <div class="row g-2">
        <div class="col-12 col-xl-4">
          <div class="p-2 bg-dark text-light rounded">
            <div class="d-flex justify-content-between align-items-center">
              <strong>Map</strong>
              <span class="small opacity-75">layer={{ mapDemo.layerAdded ? 'on' : 'off' }}</span>
            </div>

            <div class="small opacity-75 mt-2">
              <div>Map loaded: {{ mapLoaded ? 'yes' : 'no' }}</div>
              <div>Last click lng/lat: {{ lastMapClick || '—' }}</div>
              <div>Click handler: {{ click.attached ? 'on' : 'off' }}</div>
              <div class="mt-2">Notes: Click the map to see full event + rendered features.</div>
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-4">
          <div class="p-2 bg-light rounded">
            <div class="d-flex justify-content-between align-items-center">
              <strong>Features (DB)</strong>
              <span class="small text-muted">
                list={{ features.list.length }} · stream={{ features.stream.length }}
              </span>
            </div>

            <div class="small text-muted mt-2">
              <div>Stream active: {{ stream.active ? 'yes' : 'no' }}</div>
              <div>Last stream update: {{ stream.lastUpdate || '—' }}</div>
            </div>

            <details class="mt-2">
              <summary>feature.list() results (first 10)</summary>
              <pre class="mt-2 mb-0" style="max-height: 220px; overflow: auto">{{ pretty(features.list.slice(0, 10)) }}</pre>
            </details>

            <details class="mt-2">
              <summary>feature.stream() latest (first 10)</summary>
              <pre class="mt-2 mb-0" style="max-height: 220px; overflow: auto">{{ pretty(features.stream.slice(0, 10)) }}</pre>
            </details>
          </div>
        </div>

        <div class="col-12 col-xl-4">
          <div class="p-2 bg-light rounded">
            <div class="d-flex justify-content-between align-items-center">
              <strong>Last click (summary)</strong>
              <span class="small text-muted">{{ click.attached ? 'handler: on' : 'handler: off' }}</span>
            </div>

            <div class="small text-muted mt-2" v-if="click.last.summary">
              <div><strong>type</strong>: {{ click.last.summary.type }}</div>
              <div><strong>lngLat</strong>: {{ click.last.summary.lngLat }}</div>
              <div><strong>point</strong>: {{ click.last.summary.point }}</div>
              <div><strong>originalEvent</strong>: {{ click.last.summary.originalEvent }}</div>
              <div class="mt-2"><strong>renderedFeatures</strong>: {{ click.last.summary.renderedFeatureCount }}</div>
              <div><strong>topFeature.layer</strong>: {{ click.last.summary.topLayerId }}</div>
            </div>

            <div class="small text-muted mt-2" v-else>
              Click the map to populate details.
            </div>

            <details class="mt-2">
              <summary>Last click (raw-ish JSON)</summary>
              <pre class="mt-2 mb-0" style="max-height: 220px; overflow: auto">{{ pretty(click.last.details) }}</pre>
            </details>
          </div>
        </div>
      </div>

      <div class="alert alert-warning mt-3 mb-0" v-if="error">
        <strong>Last error:</strong>
        <div class="small" style="white-space: pre-wrap">{{ error }}</div>
      </div>

      <div class="alert alert-info mt-3 mb-0">
        <strong>Note</strong>
        <div class="small">
          This component demonstrates PluginAPI:
          <code>api.map</code> (source/layer/events/queryRenderedFeatures),
          <code>api.feature.list</code>,
          <code>api.feature.stream</code> (RxJS subscription),
          and <code>api.float.add/remove/has</code>.
          Routes/menu are typically handled in <code>enable()</code>.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import type { PluginAPI, DBFeature } from '@tak-ps/cloudtak';
import type { Subscription } from 'rxjs';

const props = defineProps<{ api: PluginAPI }>();

/**
 * -----------------------------
 * Utilities
 * -----------------------------
 */
const error = ref<string>('');
function setError(e: unknown, context: string) {
  const msg = e instanceof Error ? (e.stack || e.message) : String(e);
  error.value = `[${context}] ${msg}`;
}

function pretty(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/**
 * -----------------------------
 * feature.list() + feature.stream()
 * -----------------------------
 */
const busy = ref({ list: false });

const features = ref<{
  list: DBFeature[];
  stream: DBFeature[];
}>({
  list: [],
  stream: []
});

const stream = ref<{
  active: boolean;
  sub: Subscription | null;
  lastUpdate: string;
}>({
  active: false,
  sub: null,
  lastUpdate: ''
});

async function refreshFeatureList() {
  busy.value.list = true;
  error.value = '';
  try {
    features.value.list = await props.api.feature.list();
  } catch (e) {
    setError(e, 'feature.list');
  } finally {
    busy.value.list = false;
  }
}

function startFeatureStream() {
  if (stream.value.active) return;

  error.value = '';

  try {
    const obs = props.api.feature.stream();
    const sub = obs.subscribe({
      next: (rows) => {
        features.value.stream = rows;
        stream.value.lastUpdate = new Date().toISOString();
      },
      error: (e) => setError(e, 'feature.stream subscribe')
    });

    stream.value.sub = sub;
    stream.value.active = true;
  } catch (e) {
    setError(e, 'feature.stream');
  }
}

function stopFeatureStream() {
  stream.value.sub?.unsubscribe();
  stream.value.sub = null;
  stream.value.active = false;
}

function toggleFeatureStream() {
  if (stream.value.active) stopFeatureStream();
  else startFeatureStream();
}

/**
 * -----------------------------
 * api.map demo
 * - add a simple GeoJSON source + circle layer
 * - click handler + show full click event data
 * -----------------------------
 */
const mapLoaded = ref(false);
const lastMapClick = ref<string>('');

const mapDemo = ref({
  sourceId: 'plugin-helloworld-source',
  layerId: 'plugin-helloworld-layer',
  layerAdded: false
});

/**
 * Click handler state
 */
const click = ref<{
  attached: boolean;
  last: {
    summary: null | {
      type: string;
      lngLat: string;
      point: string;
      originalEvent: string;
      renderedFeatureCount: number;
      topLayerId: string;
    };
    details: any;
  };
}>({
  attached: false,
  last: {
    summary: null,
    details: null
  }
});

function clearClick() {
  click.value.last.summary = null;
  click.value.last.details = null;
  lastMapClick.value = '';
}

function safeFeatureState(map: any, source: string, id: any) {
  try {
    if (typeof map.getFeatureState !== 'function') return null;
    return map.getFeatureState({ source, id });
  } catch {
    return null;
  }
}

/**
 * Stable handler reference is required for map.off(...)
 */
function onMapClick(e: any) {
  try {
    error.value = '';

    const type = e?.type ?? 'unknown';
    const lng = e?.lngLat?.lng;
    const lat = e?.lngLat?.lat;
    const x = e?.point?.x;
    const y = e?.point?.y;

    if (typeof lng === 'number' && typeof lat === 'number') {
      lastMapClick.value = `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
    }

    const oe = e?.originalEvent;
    const originalEventSummary = oe
      ? `button=${oe.button} buttons=${oe.buttons} detail=${oe.detail} ` +
        `shift=${!!oe.shiftKey} alt=${!!oe.altKey} ctrl=${!!oe.ctrlKey} meta=${!!oe.metaKey} ` +
        `client=(${oe.clientX},${oe.clientY}) screen=(${oe.screenX},${oe.screenY})`
      : 'none';

    const map = props.api.map;

    const rendered = map?.queryRenderedFeatures && e?.point
      ? map.queryRenderedFeatures(e.point)
      : [];

    const top = rendered?.[0];

    click.value.last.summary = {
      type: String(type),
      lngLat: (typeof lng === 'number' && typeof lat === 'number')
        ? `${lng.toFixed(6)}, ${lat.toFixed(6)}`
        : '—',
      point: (typeof x === 'number' && typeof y === 'number')
        ? `${x}, ${y}`
        : '—',
      originalEvent: originalEventSummary,
      renderedFeatureCount: Array.isArray(rendered) ? rendered.length : 0,
      topLayerId: top?.layer?.id ?? '—'
    };

    click.value.last.details = {
      type: e?.type,
      hasTarget: !!e?.target,
      lngLat: e?.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null,
      point: e?.point ? { x: e.point.x, y: e.point.y } : null,

      originalEvent: oe
        ? {
            type: oe.type,
            button: oe.button,
            buttons: oe.buttons,
            detail: oe.detail,
            shiftKey: oe.shiftKey,
            altKey: oe.altKey,
            ctrlKey: oe.ctrlKey,
            metaKey: oe.metaKey,
            clientX: oe.clientX,
            clientY: oe.clientY,
            screenX: oe.screenX,
            screenY: oe.screenY
          }
        : null,

      renderedFeatures: (rendered || []).slice(0, 25).map((f: any) => ({
        id: f?.id ?? null,
        layer: f?.layer ? { id: f.layer.id, type: f.layer.type, source: f.layer.source } : null,
        source: f?.source ?? null,
        sourceLayer: f?.sourceLayer ?? null,
        state: (map && f?.id != null && f?.source)
          ? safeFeatureState(map, f.source, f.id)
          : null,
        geometryType: f?.geometry?.type ?? null,
        properties: f?.properties ?? null
      }))
    };
  } catch (e2) {
    setError(e2, 'onMapClick');
  }
}

function attachClickHandler() {
  try {
    const map = props.api.map;
    if (!map) throw new Error('api.map not available');
    map.off('click', onMapClick);
    map.on('click', onMapClick);
    click.value.attached = true;
  } catch (e) {
    setError(e, 'attachClickHandler');
  }
}

function detachClickHandler() {
  try {
    const map = props.api.map;
    if (!map) return;
    map.off('click', onMapClick);
    click.value.attached = false;
  } catch (e) {
    setError(e, 'detachClickHandler');
  }
}

function ensureMapDemo() {
  error.value = '';
  try {
    const map = props.api.map;
    if (!map) {
      throw new Error('api.map is not available (map store not ready)');
    }

    const addNow = () => {
      if (!map.getSource(mapDemo.value.sourceId)) {
        map.addSource(mapDemo.value.sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { name: 'Plugin Demo Point' },
                geometry: { type: 'Point', coordinates: [-104.9903, 39.7392] }
              }
            ]
          }
        } as any);
      }

      if (!map.getLayer(mapDemo.value.layerId)) {
        map.addLayer({
          id: mapDemo.value.layerId,
          type: 'circle',
          source: mapDemo.value.sourceId,
          paint: {
            'circle-radius': 8,
            'circle-color': '#22c55e',
            'circle-stroke-color': '#0f172a',
            'circle-stroke-width': 2
          }
        } as any);
      }

      mapDemo.value.layerAdded = true;
      mapLoaded.value = true;
    };

    if (map.isStyleLoaded && map.isStyleLoaded()) {
      addNow();
    } else {
      map.once('load', () => {
        try {
          addNow();
        } catch (e) {
          setError(e, 'map.once(load)');
        }
      });
    }
  } catch (e) {
    setError(e, 'api.map ensureMapDemo');
  }
}

function removeMapDemo() {
  error.value = '';
  try {
    const map = props.api.map;
    if (!map) return;

    if (map.getLayer(mapDemo.value.layerId)) {
      map.removeLayer(mapDemo.value.layerId);
    }
    if (map.getSource(mapDemo.value.sourceId)) {
      map.removeSource(mapDemo.value.sourceId);
    }

    mapDemo.value.layerAdded = false;
  } catch (e) {
    setError(e, 'api.map removeMapDemo');
  }
}

/**
 * -----------------------------
 * api.float demo
 * - open a floating pane with content + actions
 * -----------------------------
 */
const floatUid = 'plugin-helloworld-float';
const float = computed(() => ({
  has: props.api.float.has(floatUid)
}));

const FloatContent = defineComponent({
  name: 'PluginHelloWorldFloatContent',
  props: {
    title: { type: String, required: true },
    api: { type: Object as () => PluginAPI, required: true }
  },
  setup(p) {
    const centerText = ref<string>('—');

    function readCenter() {
      try {
        const map = p.api.map;
        const c = map.getCenter();
        centerText.value = `${c.lng.toFixed(5)}, ${c.lat.toFixed(5)}`;
      } catch (e) {
        centerText.value = 'map not ready';
      }
    }

    onMounted(readCenter);

    return () =>
      h('div', { class: 'p-2' }, [
        h('div', { class: 'fw-bold mb-1' }, p.title),
        h('div', { class: 'small text-muted mb-2' }, 'This is a floating pane created via api.float.add().'),
        h('div', { class: 'small' }, `Map center: ${centerText.value}`),
        h(
          'button',
          { class: 'btn btn-sm btn-outline-primary mt-2', onClick: readCenter },
          'Refresh center'
        )
      ]);
  }
});

const FloatActions = defineComponent({
  name: 'PluginHelloWorldFloatActions',
  props: {
    api: { type: Object as () => PluginAPI, required: true }
  },
  setup() {
    return () =>
      h('div', { class: 'd-flex gap-2 align-items-center' }, [
        h('div', { class: 'small text-muted' }, 'Actions slot')
      ]);
  }
});

function openFloatingPane() {
  error.value = '';
  try {
    if (props.api.float.has(floatUid)) return;

    props.api.float.add({
      uid: floatUid,
      name: 'Plugin Float Demo',
      component: FloatContent as any,
      actions: FloatActions as any,
      props: {
        title: 'Float Demo',
        api: props.api
      },
      width: 420,
      height: 260,
      x: 40,
      y: 40
    });
  } catch (e) {
    setError(e, 'api.float.add');
  }
}

function closeFloatingPane() {
  error.value = '';
  try {
    props.api.float.remove(floatUid);
  } catch (e) {
    setError(e, 'api.float.remove');
  }
}

/**
 * -----------------------------
 * Lifecycle cleanup
 * -----------------------------
 */
onMounted(() => {
  refreshFeatureList();
  ensureMapDemo();
  attachClickHandler();
});

onBeforeUnmount(() => {
  stopFeatureStream();
  detachClickHandler();
  removeMapDemo();
  closeFloatingPane();
});
</script>

<style scoped>
pre {
  font-size: 12px;
}
</style>
