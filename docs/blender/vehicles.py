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
P = math.pi; OUT = os.path.expanduser('~/Desktop/lagos-game/public/models/'); IMG = '/Users/okolijeff/.claude/jobs/c161618b/tmp/veh/'
def sedan(name, L=4.4, W=1.8, r=0.33, bumper='paint2', chrome_trim=False):
    c = Car(name)
    c.box('paint', (W, L, 0.56), (0, 0, 0.64), bevel=0.13, seg=4)                                        # body
    c.box('glass', (W * 0.9, L * 0.48, 0.42), (0, 0.22, 1.12), bevel=0.1, seg=3, taper=(0.42, 0.32, 0.86))  # glasshouse
    c.box('paint', (W * 0.78, L * 0.3, 0.07), (0, 0.28, 1.34), bevel=0.03)                               # roof
    for sx in (-1, 1):
        c.box('paint', (0.05, 0.1, 0.3), (sx * W * 0.43, 0.15, 1.05))                                     # B pillar
        c.box('black', (0.02, 0.012, 0.42), (sx * (W / 2 - 0.005), -0.2, 0.66)); c.box('black', (0.02, 0.012, 0.42), (sx * (W / 2 - 0.005), 0.75, 0.66))  # door seams
        for y in (-0.05, 0.9): c.box('chrome' if chrome_trim else 'black', (0.03, 0.14, 0.025), (sx * (W / 2 + 0.005), y, 0.8))  # handles
        c.box('black', (0.12, 0.03, 0.03), (sx * (W / 2 + 0.03), -0.65, 0.98)); c.box('paint', (0.05, 0.16, 0.1), (sx * (W / 2 + 0.08), -0.65, 0.98), bevel=0.02)  # mirrors
        c.cyl('black', r + 0.07, 0.04, (sx * (W / 2 - 0.01), -L * 0.31, r), seg=24); c.cyl('black', r + 0.07, 0.04, (sx * (W / 2 - 0.01), L * 0.31, r), seg=24)
        c.wheel(sx * (W / 2 - 0.12), -L * 0.31, r, 0.22); c.wheel(sx * (W / 2 - 0.12), L * 0.31, r, 0.22)
        c.box('light_head', (0.38, 0.05, 0.13), (sx * 0.6, -L / 2 + 0.01, 0.74), bevel=0.02)
        c.box('light_tail', (0.36, 0.05, 0.12), (sx * 0.62, L / 2 - 0.01, 0.78), bevel=0.02)
        c.box('light_amber', (0.1, 0.04, 0.06), (sx * 0.84, -L / 2 + 0.02, 0.6))
    c.box('black', (0.8, 0.04, 0.16), (0, -L / 2 + 0.005, 0.68), bevel=0.02)                                # grille
    c.box('chrome' if chrome_trim else 'chrome', (0.12, 0.02, 0.08), (0, -L / 2 - 0.01, 0.7))                # badge
    c.box('chrome' if chrome_trim else bumper, (W + 0.04, 0.16, 0.16), (0, -L / 2 - 0.02, 0.45), bevel=0.05)
    c.box('chrome' if chrome_trim else bumper, (W + 0.04, 0.16, 0.16), (0, L / 2 + 0.02, 0.45), bevel=0.05)
    c.box('white', (0.48, 0.02, 0.12), (0, -L / 2 - 0.11, 0.48)); c.box('white', (0.48, 0.02, 0.12), (0, L / 2 + 0.11, 0.62))
    return c.finish()
done = {}
done['car'] = sedan('V_car')
done['getaway'] = sedan('V_getaway', L=4.5, W=1.85, r=0.35, chrome_trim=True)
# ---- police Hilux: black pickup, blue band, open bed with a roll bar
c = Car('V_police')
c.box('paint', (1.95, 4.8, 0.72), (0, 0, 0.78), bevel=0.11, seg=3)
for sx in (-1, 1): c.box('blue', (0.02, 4.7, 0.17), (sx * 0.98, 0, 0.92))
c.box('glass', (1.8, 1.95, 0.5), (0, -0.7, 1.4), bevel=0.08, taper=(0.35, 0.08, 0.9))
c.box('paint', (1.62, 1.45, 0.07), (0, -0.58, 1.66), bevel=0.03)
for sx in (-1, 1):
    c.box('paint', (0.05, 0.12, 0.36), (sx * 0.84, -0.55, 1.33))
    c.box('paint', (0.08, 2.2, 0.32), (sx * 0.935, 1.35, 1.29), bevel=0.03)                           # bed walls
    c.cyl('black', 0.47, 0.05, (sx * 0.97, -1.5, 0.4), seg=24); c.cyl('black', 0.47, 0.05, (sx * 0.97, 1.5, 0.4), seg=24)
    c.wheel(sx * 0.84, -1.5, 0.4, 0.26, hub='metal'); c.wheel(sx * 0.84, 1.5, 0.4, 0.26, hub='metal')
    c.box('light_head', (0.38, 0.05, 0.15), (sx * 0.62, -2.4, 0.95), bevel=0.02); c.box('light_tail', (0.12, 0.05, 0.36), (sx * 0.9, 2.41, 1.05))
    c.box('black', (0.12, 0.03, 0.03), (sx * 1.0, -1.35, 1.25)); c.box('black', (0.05, 0.16, 0.12), (sx * 1.06, -1.35, 1.25), bevel=0.02)
    c.box('black', (0.02, 0.012, 0.5), (sx * 0.98, -0.05, 0.8))
c.box('paint', (1.9, 0.08, 0.32), (0, 2.42, 1.29), bevel=0.03)                                        # tailgate
c.box('metal', (1.75, 2.1, 0.05), (0, 1.35, 1.12))                                                     # bed floor
c.cyl('metal', 0.035, 1.7, (0, 0.35, 1.85), rot=(0, P / 2, 0), seg=10)                                 # roll bar
for sx in (-1, 1): c.cyl('metal', 0.035, 0.5, (sx * 0.85, 0.35, 1.6), rot=(0, 0, 0), seg=10)
c.box('black', (1.4, 0.06, 0.3), (0, -2.42, 0.9), bevel=0.02)                                           # grille
c.box('black', (2.0, 0.2, 0.18), (0, -2.45, 0.5), bevel=0.04); c.box('black', (2.0, 0.18, 0.16), (0, 2.45, 0.55), bevel=0.04)
c.box('metal', (1.5, 0.1, 0.5), (0, -2.58, 0.75), bevel=0.02)                                           # bull bar
c.box('white', (0.48, 0.02, 0.12), (0, -2.56, 0.5))
done['police'] = c.finish()
# ---- fuel tanker
c = Car('V_tanker')
c.box('white', (2.4, 2.3, 1.7), (0, -3.4, 1.55), bevel=0.12)                                           # cab
c.box('glass', (2.2, 0.05, 0.75), (0, -4.56, 1.95), rot=(-0.08, 0, 0), bevel=0.04)
for sx in (-1, 1):
    c.box('glass', (0.04, 1.0, 0.65), (sx * 1.2, -3.6, 1.95), bevel=0.03)
    c.box('black', (0.15, 0.05, 0.05), (sx * 1.25, -4.3, 2.1)); c.box('black', (0.06, 0.18, 0.4), (sx * 1.33, -4.3, 2.0), bevel=0.02)
    c.cyl('metal', 0.28, 1.0, (sx * 1.0, -1.6, 0.85), rot=(P / 2, 0, 0), seg=16)                       # diesel tanks
    for y in (-3.6, 2.4, 3.6, 4.3):
        c.wheel(sx * 1.05, y, 0.5, 0.3, hub='metal')
    c.box('light_head', (0.42, 0.05, 0.2), (sx * 0.8, -4.57, 1.1), bevel=0.02); c.box('light_tail', (0.3, 0.05, 0.2), (sx * 1.0, 4.76, 0.9))
c.box('black', (2.3, 0.06, 0.55), (0, -4.56, 1.1), bevel=0.02)                                         # grille
c.box('black', (2.45, 0.25, 0.25), (0, -4.62, 0.6), bevel=0.05)
c.box('metal', (2.0, 7.4, 0.28), (0, 0.9, 0.8))                                                        # chassis
c.cyl('paint', 1.2, 6.8, (0, 1.2, 2.05), rot=(P / 2, 0, 0), seg=32, bevel=0.15)                       # the tank
for y in (-1.0, 1.2, 3.4): c.cyl('white', 1.215, 0.18, (0, y, 2.05), rot=(P / 2, 0, 0), seg=32)
c.box('metal', (0.8, 5.5, 0.06), (0, 1.2, 3.3)); 
for y in (-0.6, 1.2, 3.0): c.cyl('metal', 0.25, 0.12, (0, y, 3.28), rot=(0, 0, 0), seg=16)          # hatches
for sx in (-1, 1): c.box('metal', (0.03, 5.5, 0.03), (sx * 0.4, 1.2, 3.55))                            # rails
c.box('black', (2.3, 0.3, 0.6), (0, 4.62, 0.95))                                                        # rear guard
done['tanker'] = c.finish()
# ---- BRT bus
c = Car('V_brt'); L = 11.5
c.box('paint', (2.55, L, 2.3), (0, 0, 1.6), bevel=0.14, seg=3)
for sx in (-1, 1):
    c.box('glass', (0.04, L - 1.4, 0.95), (sx * 1.27, 0.3, 2.15), bevel=0.04)
    for k in range(9): c.box('paint', (0.05, 0.08, 0.95), (sx * 1.28, -4.1 + k * 1.0, 2.15))             # window pillars
    c.box('red', (0.03, L - 0.1, 0.25), (sx * 1.275, 0, 1.45))
    for y in (-4.2, 3.6, 4.8): c.cyl('black', 0.6, 0.05, (sx * 1.26, y, 0.5), seg=24); c.wheel(sx * 1.1, y, 0.5, 0.3, hub='metal')
    c.box('black', (0.12, 0.05, 0.05), (sx * 1.33, -5.55, 2.4)); c.box('black', (0.06, 0.2, 0.4), (sx * 1.4, -5.6, 2.3), bevel=0.02)
c.box('interior', (0.05, 1.2, 1.9), (1.27, -3.2, 1.45)); c.box('interior', (0.05, 1.2, 1.9), (1.27, 1.0, 1.45))  # doors (passenger side)
c.box('glass', (2.3, 0.05, 1.3), (0, -5.75, 2.05), bevel=0.05)                                           # windscreen
c.box('glass', (2.1, 0.05, 0.7), (0, 5.75, 2.3), bevel=0.04)
c.box('white', (2.3, L - 1.0, 0.12), (0, 0, 2.8), bevel=0.04)                                            # roof
c.box('metal', (1.6, 2.6, 0.3), (0, 2.5, 2.9), bevel=0.05)                                               # roof AC unit
c.box('light_amber', (1.6, 0.04, 0.25), (0, -5.77, 2.73))                                                # destination board
for sx in (-1, 1): c.box('light_head', (0.4, 0.05, 0.2), (sx * 0.85, -5.77, 0.9), bevel=0.02); c.box('light_tail', (0.3, 0.05, 0.3), (sx * 1.0, 5.77, 1.0))
c.box('black', (2.6, 0.2, 0.3), (0, -5.78, 0.55), bevel=0.05); c.box('black', (2.6, 0.2, 0.3), (0, 5.78, 0.55), bevel=0.05)
done['brt'] = c.finish()
# ---- keke NAPEP (Bajaj RE)
c = Car('V_keke')
c.sphere('paint', 0.5, (0, -1.15, 0.98), scale=(0.95, 0.62, 0.85))                                       # rounded nose
c.box('paint', (0.95, 0.6, 0.95), (0, -1.0, 1.0), bevel=0.12)
c.box('black', (0.9, 0.06, 0.3), (0, -1.5, 0.98), bevel=0.03)                                            # face band
for sx in (-1, 1):
    c.cyl('chrome', 0.1, 0.04, (sx * 0.3, -1.53, 0.98), rot=(P / 2, 0, 0)); c.cyl('light_head', 0.08, 0.04, (sx * 0.3, -1.55, 0.98), rot=(P / 2, 0, 0))
    c.box('light_amber', (0.1, 0.04, 0.06), (sx * 0.4, -1.5, 0.78))
c.box('glass', (0.92, 0.04, 0.6), (0, -1.22, 1.6), rot=(-0.2, 0, 0), bevel=0.03)
c.box('black', (0.02, 0.5, 0.03), (0, -1.28, 1.6), rot=(0.2, 0, 0.5))
c.box('paint', (1.0, 0.6, 0.08), (0, -1.05, 1.93), bevel=0.03)
c.wheel(0.0, -1.25, 0.24, 0.12); c.cyl('paint', 0.29, 0.16, (0, -1.25, 0.34), seg=20, r2=None)          # front wheel and mudguard
c.box('metal', (1.0, 1.3, 0.1), (0, -0.25, 0.42))                                                         # floor
c.box('seat', (0.55, 0.35, 0.12), (0, -0.45, 0.85), bevel=0.03)                                          # driver's seat
c.box('paint', (1.38, 1.15, 0.75), (0, 0.75, 0.78), bevel=0.1)                                            # rear tub
c.box('seat', (1.3, 0.85, 0.14), (0, 0.75, 1.2), bevel=0.04); c.box('seat', (1.3, 0.12, 0.55), (0, 1.25, 1.46), bevel=0.04)
for sx in (-1, 1):
    c.cyl('paint', 0.3, 0.17, (sx * 0.66, 0.85, 0.44), seg=20); c.wheel(sx * 0.66, 0.85, 0.25, 0.14)
    c.box('paint', (0.04, 0.8, 0.25), (sx * 0.68, 0.15, 0.95), bevel=0.02)
    c.cyl('metal', 0.022, 2.1, (sx * 0.66, 0.2, 1.95), rot=(P / 2, 0, 0), seg=8); c.cyl('metal', 0.022, 1.1, (sx * 0.66, -0.5, 1.4), rot=(0, 0, 0), seg=8)
    c.box('black', (0.1, 0.03, 0.03), (sx * 0.55, -1.3, 1.7)); c.box('black', (0.05, 0.1, 0.14), (sx * 0.62, -1.3, 1.7), bevel=0.02)
    c.box('light_tail', (0.12, 0.04, 0.14), (sx * 0.6, 1.34, 0.85))
c.box('canvas', (1.42, 1.9, 0.06), (0, 0.35, 2.0), bevel=0.02)
c.cyl('canvas', 0.6, 1.42, (0, 1.25, 1.5), rot=(0, P / 2, 0), seg=20)
c.box('paint', (1.44, 0.05, 0.05), (0, 0.35, 1.96))
c.box('white', (0.3, 0.02, 0.12), (0, 1.34, 0.6))
done['keke'] = c.finish()
# ---- okada (a 125cc commuter bike)
c = Car('V_okada')
for y, wd in ((-0.72, 0.1), (0.7, 0.12)):
    c.cyl('tyre', 0.33, wd, (0, y, 0.33), seg=28, bevel=0.03); c.cyl('chrome', 0.22, wd + 0.01, (0, y, 0.33), seg=24); c.cyl('metal', 0.06, wd + 0.04, (0, y, 0.33), seg=12)
c.box('paint', (0.24, 0.5, 0.2), (0, -0.25, 0.92), bevel=0.08)                                            # fuel tank
c.box('seat', (0.28, 0.75, 0.12), (0, 0.25, 0.88), bevel=0.05)                                            # seat
c.box('paint', (0.22, 0.55, 0.2), (0, 0.55, 0.72), bevel=0.06)                                            # side panel / tail
c.box('metal', (0.26, 0.4, 0.3), (0, -0.05, 0.5), bevel=0.04)                                             # engine
c.cyl('chrome', 0.04, 0.7, (0.14, 0.25, 0.42), rot=(P / 2 - 0.1, 0, 0), seg=10)                         # exhaust
c.cyl('metal', 0.03, 0.75, (0, -0.62, 0.72), rot=(-0.35, 0, 0), seg=8)                                    # forks
c.cyl('chrome', 0.018, 0.72, (0, -0.6, 1.07), rot=(0, P / 2, 0), seg=8)                                   # handlebar
for sx in (-1, 1): c.box('black', (0.05, 0.12, 0.05), (sx * 0.34, -0.6, 1.07))
c.box('paint', (0.16, 0.42, 0.05), (0, -0.72, 0.68), rot=(0.25, 0, 0), bevel=0.02)                       # front mudguard
c.box('paint', (0.18, 0.5, 0.05), (0, 0.72, 0.68), rot=(-0.3, 0, 0), bevel=0.02)                        # rear mudguard
c.cyl('chrome', 0.1, 0.08, (0, -0.8, 0.98), rot=(P / 2, 0, 0)); c.cyl('light_head', 0.085, 0.06, (0, -0.84, 0.98), rot=(P / 2, 0, 0))
c.box('light_tail', (0.14, 0.04, 0.07), (0, 0.84, 0.78))
c.box('metal', (0.05, 0.6, 0.05), (0, 0.0, 0.7), rot=(0.4, 0, 0))                                        # frame
done['okada'] = c.finish()
for k, o in done.items():
    o.location.x = 0; export(o, OUT + k + '.glb')
    render([o], IMG + k + '.png', dist={'tanker': 15, 'brt': 18, 'okada': 4, 'keke': 6}.get(k, 9), ang=-2.4)
print({k: len(o.data.polygons) for k, o in done.items()})
