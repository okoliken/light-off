import bpy, bmesh, math
from mathutils import Vector, Matrix
COL = {'paint': (0.9, 0.62, 0.02), 'glass': (0.02, 0.03, 0.045), 'black': (0.012, 0.012, 0.012), 'tyre': (0.015, 0.015, 0.015), 'chrome': (0.6, 0.6, 0.62),
       'metal': (0.12, 0.12, 0.12), 'interior': (0.03, 0.03, 0.03), 'light_head': (1, 0.95, 0.8), 'light_amber': (1, 0.5, 0), 'light_tail': (1, 0.08, 0.03),
       'white': (0.85, 0.85, 0.85), 'blue': (0.05, 0.15, 0.6), 'red': (0.6, 0.03, 0.03), 'seat': (0.05, 0.04, 0.035), 'paint2': (0.05, 0.05, 0.06), 'canvas': (0.02, 0.02, 0.02)}
def mat(name):
    m = bpy.data.materials.get('V_' + name)
    if not m:
        m = bpy.data.materials.new('V_' + name); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*COL[name], 1)
        b.inputs['Roughness'].default_value = 0.15 if name == 'glass' else 0.35 if name in ('paint', 'paint2', 'chrome') else 0.8
        b.inputs['Metallic'].default_value = 0.9 if name == 'chrome' else 0.0
        if name.startswith('light'): b.inputs['Emission Color'].default_value = (*COL[name], 1); b.inputs['Emission Strength'].default_value = 3
    return m
class Car:
    def __init__(self, name):
        self.name = name; self.parts = []
        old = bpy.data.objects.get(name)
        if old: bpy.data.objects.remove(old)
        self.col = bpy.data.collections.get('Vehicles') or bpy.data.collections.new('Vehicles')
        if self.col.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(self.col)
    def _obj(self, bm, m, bevel=0, seg=3, smooth=True, mods=()):
        me = bpy.data.meshes.new('p'); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('p', me); self.col.objects.link(o); me.materials.append(mat(m))
        if bevel:
            bv = o.modifiers.new('b', 'BEVEL'); bv.width = bevel; bv.segments = seg; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(35)
        for f in me.polygons: f.use_smooth = smooth
        if smooth:
            ws = o.modifiers.new('w', 'WEIGHTED_NORMAL'); ws.keep_sharp = True
        self.parts.append(o); return o
    def box(self, m, size, loc, rot=(0, 0, 0), bevel=0, seg=3, taper=None):
        """size (x width, y length, z height); loc centre; forward is -Y. taper: (top_front_back_shift) etc."""
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
            if taper and v.co.z > 0:
                if v.co.y < 0: v.co.y += taper[0]   # pull the top-front back (a raked nose)
                else: v.co.y -= taper[1]
                v.co.x *= taper[2] if len(taper) > 2 else 1
        bmesh.ops.transform(bm, matrix=Matrix.LocRotScale(Vector(loc), __import__('mathutils').Euler(rot), None), verts=bm.verts)
        return self._obj(bm, m, bevel, seg, smooth=bool(bevel))
    def cyl(self, m, r, depth, loc, rot=(0, math.pi / 2, 0), seg=24, bevel=0, r2=None):
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r2 if r2 is not None else r, depth=depth)
        bmesh.ops.transform(bm, matrix=Matrix.LocRotScale(Vector(loc), __import__('mathutils').Euler(rot), None), verts=bm.verts)
        return self._obj(bm, m, bevel, 2, smooth=True)
    def sphere(self, m, r, loc, scale=(1, 1, 1)):
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r)
        for v in bm.verts: v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + Vector(loc)
        return self._obj(bm, m, 0, smooth=True)
    def wheel(self, x, y, r, w, hub='chrome'):
        s = 1 if x > 0 else -1
        self.cyl('tyre', r, w, (x, y, r), bevel=0.04, seg=28)
        self.cyl(hub, r * 0.58, w + 0.01, (x + s * 0.01, y, r), seg=20, bevel=0.01)
        self.cyl('metal', r * 0.18, w + 0.03, (x + s * 0.02, y, r), seg=12)
        for k in range(5):  # lug nuts
            a = k / 5 * math.tau; self.cyl('metal', 0.018, w + 0.035, (x + s * 0.02, y + math.cos(a) * r * 0.32, r + math.sin(a) * r * 0.32), seg=6)
    def finish(self):
        for o in bpy.context.view_layer.objects: o.select_set(False)
        dg = bpy.context.evaluated_depsgraph_get()
        for o in self.parts:
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), depsgraph=dg); o.modifiers.clear(); o.data = me
            o.select_set(True)
        bpy.context.view_layer.objects.active = self.parts[0]; bpy.ops.object.join()
        o = self.parts[0]; o.name = self.name
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.0005); bpy.ops.object.mode_set(mode='OBJECT')
        return o
def export(o, path):
    for x in bpy.context.view_layer.objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_animations=False, export_yup=True, export_apply=True)
def render(objs, path, dist=8.5, z=1.1, ang=0.75, lens=45):
    sc = bpy.context.scene
    for x in bpy.data.objects:
        if x.type == 'MESH': x.hide_render = x not in objs
    cam = sc.camera; tgt = Vector((0, 0, z)); pos = Vector((math.sin(ang) * dist, -math.cos(ang) * dist, z + 1.2))
    cam.location = pos; cam.rotation_euler = (tgt - pos).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
import os
c = Car('V_danfo'); P = math.pi
c.box('paint', (1.98, 4.7, 1.0), (0, 0, 0.95), bevel=0.09)                                   # lower body
c.box('paint', (1.94, 4.5, 0.86), (0, 0.05, 1.88), bevel=0.16, seg=4, taper=(0.13, 0.04, 0.97))  # upper body: raked nose, rounded roof
for sx in (-1, 1):
    for y, w in ((-1.55, 0.78), (-0.45, 1.02), (0.7, 1.02), (1.72, 0.74)):
        c.box('glass', (0.03, w, 0.52), (sx * 0.965, y, 1.9), bevel=0.04)
    for z in (1.36, 1.22): c.box('black', (0.025, 4.62, 0.07), (sx * 0.995, 0, z))          # the two black stripes
    c.box('black', (0.02, 0.012, 1.55), (sx * 0.992, -1.08, 1.25))                          # cab door seam
    c.box('black', (0.03, 0.12, 0.03), (sx * 0.995, -1.2, 1.18))                            # door handle
    for k in range(6): c.box('black', (0.03, 0.035, 0.24), (sx * 0.975, 1.98 + k * 0.06, 1.62)) # engine vents
    c.cyl('black', 0.47, 0.05, (sx * 0.985, -1.5, 0.38), seg=28); c.cyl('black', 0.47, 0.05, (sx * 0.985, 1.5, 0.38), seg=28)  # wheel arches
    c.wheel(sx * 0.87, -1.5, 0.38, 0.24); c.wheel(sx * 0.87, 1.5, 0.38, 0.24)
    c.box('black', (0.16, 0.03, 0.03), (sx * 1.04, -1.95, 1.85), rot=(0, 0, 0))                # mirror arm
    c.box('black', (0.05, 0.14, 0.2), (sx * 1.13, -1.95, 1.85), bevel=0.02)                  # mirror
c.box('interior', (0.05, 1.05, 1.5), (1.0, -0.25, 1.32))                                     # the sliding door, open
c.box('seat', (1.6, 0.4, 0.45), (0.1, -0.1, 0.95), bevel=0.03); c.box('seat', (1.6, 0.12, 0.55), (0.1, 0.12, 1.35), bevel=0.03)  # bench inside
c.box('glass', (1.72, 0.03, 0.6), (0, -2.205, 1.9), rot=(-0.14, 0, 0), bevel=0.05)          # windscreen
c.box('black', (0.5, 0.012, 0.02), (-0.35, -2.24, 1.62), rot=(-0.14, 0, 0.35)); c.box('black', (0.5, 0.012, 0.02), (0.35, -2.24, 1.62), rot=(-0.14, 0, 0.35))  # wipers
c.box('glass', (1.75, 0.03, 0.48), (0, 2.31, 1.93), bevel=0.04)                              # rear window
c.box('black', (1.9, 0.05, 0.34), (0, -2.355, 0.98), bevel=0.02)                             # grille band
for sx in (-1, 1):
    c.cyl('chrome', 0.145, 0.05, (sx * 0.68, -2.37, 0.98), rot=(P / 2, 0, 0)); c.cyl('light_head', 0.12, 0.05, (sx * 0.68, -2.39, 0.98), rot=(P / 2, 0, 0))
    c.box('light_amber', (0.13, 0.04, 0.08), (sx * 0.9, -2.37, 0.72), bevel=0.01)
    c.box('light_tail', (0.16, 0.04, 0.3), (sx * 0.82, 2.37, 1.0), bevel=0.015)
c.cyl('chrome', 0.1, 0.03, (0, -2.37, 1.32), rot=(P / 2, 0, 0))                              # the badge
c.box('black', (2.02, 0.22, 0.2), (0, -2.42, 0.52), bevel=0.05); c.box('black', (2.02, 0.22, 0.2), (0, 2.42, 0.52), bevel=0.05)  # bumpers
c.box('white', (0.5, 0.02, 0.13), (0, -2.535, 0.66)); c.box('white', (0.5, 0.02, 0.13), (0, 2.535, 0.66))  # number plates
c.box('metal', (0.32, 0.4, 0.06), (-0.6, 2.62, 0.5))                                          # the step at the back
for sx in (-1, 1): c.cyl('metal', 0.022, 3.4, (sx * 0.85, 0.3, 2.43), rot=(P / 2, 0, 0), seg=8)  # roof rack rails
for y in (1.8, 0.3, -1.2): c.cyl('metal', 0.02, 1.72, (0, y, 2.43), rot=(0, P / 2, 0), seg=8)
for sx in (-1, 1):
    for y in (1.9, -1.3): c.box('metal', (0.04, 0.04, 0.14), (sx * 0.85, y, 2.36))
o = c.finish()
OUT = os.path.expanduser('~/Desktop/lagos-game/public/models/')
export(o, OUT + 'danfo.glb')
render([o], '/Users/okolijeff/.claude/jobs/c161618b/tmp/veh/danfo.png', ang=-2.4)
print('danfo', len(o.data.polygons))
