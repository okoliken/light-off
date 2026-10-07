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
