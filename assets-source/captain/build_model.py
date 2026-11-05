import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
D=Path(args[0]).resolve() if args else Path(__file__).resolve().parent/'output'
D.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)
scene=bpy.context.scene
# Original geometry, designed for the game. Blender +Y is face/front, glTF -Z is front.
def srgb(h):
    v=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple((x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4) for x in v)
def mat(name,h,rough=.65,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*srgb(h),1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return m
skin=mat('Warm peach skin','E3A17C',.75); skinLight=mat('Pale eye surround','F2C6A5',.77); skinShade=mat('Skin crease','BF795C',.8); lip=mat('Muted rose lips','C88371',.72)
hair=mat('Sandy gold hair','D8B665',.68);hairHi=mat('Hair comb highlights','E9CA80',.68);hairLow=mat('Hair sweep grooves','BA974F',.75)
navy=mat('Midnight blue wool','233347',.82);navyLight=mat('Tailored lapels','2D4159',.8);navyShade=mat('Suit seams','172435',.85)
shirt=mat('Ivory shirt','F7F2E9',.8);red=mat('Long red tie','B5262C',.65);redHi=mat('Tie soft highlight','C53B3E',.7);shoe=mat('Polished leather','24272B',.4)
white=mat('Eyes','EDF1EE',.5);blue=mat('Blue grey irises','668E9D',.45);black=mat('Pupils','17212C',.45);gold=mat('Lapel pin gold','D9BA65',.35,.55)
all_mesh=[];nodes={}
def parent_keep(o,p):
    if p:
        bpy.context.view_layer.update(); mw=o.matrix_world.copy();o.parent=p;o.matrix_world=mw; bpy.context.view_layer.update()

def pivot(name,loc,parent=None):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc;parent_keep(o,parent);nodes[name]=o;return o
root=pivot('Captain_Root',(0,0,0));hips=pivot('hips',(0,0,1.35),root);chest=pivot('chest',(0,0,1.58),hips);head=pivot('head',(0,0,2.82),chest)
def finish(o,name,m,p=None):
    o.name=name
    if m:o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
    parent_keep(o,p);all_mesh.append(o);return o

def uv(name,loc,scale,m,p=None,segments=32,rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,m,p)
def mesh(name,verts,faces,m,p=None):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);return finish(o,name,m,p)
def rings(name,rows,m,p=None,n=40,sub=1):
    # Each row (z, radius_x, radius_y, center_y) describes a rounded tailored surface.
    vs=[];fs=[]
    for z,rx,ry,cy in rows:
        for i in range(n):
            a=i*math.tau/n;vs.append((rx*math.cos(a),cy+ry*math.sin(a),z))
    for j in range(len(rows)-1):
        for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    if not name.startswith('Trousers'):
        fs.append(tuple(reversed(range(n))));fs.append(tuple((len(rows)-1)*n+i for i in range(n)))
    o=mesh(name,vs,fs,m,p)
    if sub:
        mod=o.modifiers.new('Soft silhouette','SUBSURF');mod.levels=sub;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def tube(name,pts,radii,m,p=None,sides=10):
    pts=[Vector(x) for x in pts];vs=[];fs=[]
    for i,pt in enumerate(pts):
        d=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized();n=d.cross(Vector((0,0,1)))
        if n.length<.01:n=d.cross(Vector((0,1,0)))
        n.normalize();b=d.cross(n).normalized()
        rr=radii[i] if isinstance(radii,list) else radii
        rx,ry=rr if isinstance(rr,tuple) else (rr,rr)
        for j in range(sides):
            a=j*math.tau/sides;vs.append(pt+n*math.cos(a)*rx+b*math.sin(a)*ry)
    for i in range(len(pts)-1):
        for j in range(sides):fs.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    fs.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))]);return mesh(name,vs,fs,m,p)
def bezier(a,b,c,d,n=25):
    a,b,c,d=map(Vector,(a,b,c,d));return [tuple((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d) for t in [i/(n-1) for i in range(n)]]
def patch(name,points,m,p,thick=.025):
    o=mesh(name,points,[tuple(range(len(points)))],m,p)
    mod=o.modifiers.new('Fabric thickness','SOLIDIFY');mod.thickness=thick;mod=o.modifiers.new('Soft cloth edges','BEVEL');mod.width=.025;mod.segments=3
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
# Articulated, gently bowed trouser legs and shaped leather shoes.
for side,suffix in [(-1,'L'),(1,'R')]:
    x=side*.30
    thigh=pivot('thigh.'+suffix,(x,0,1.40),hips);shin=pivot('shin.'+suffix,(x,.025,.77),thigh);foot=pivot('foot.'+suffix,(x,.04,.23),shin)
    o=rings('Trousers thigh '+suffix,[(.69,.23,.23,0),(.75,.24,.24,0),(1.12,.27,.26,0),(1.42,.28,.27,-.015),(1.49,.22,.22,0)],navy,thigh);o.location.x+=x
    o=rings('Trousers lower '+suffix,[(.23,.215,.235,.025),(.28,.22,.24,.025),(.55,.23,.235,.015),(.79,.235,.235,0),(.84,.21,.21,0)],navy,shin);o.location.x+=x
    # Soft pressed center crease, not cuboid shins.
    tube('Trouser pressed crease '+suffix,[(x,.266,.34),(x,.252,.65),(x,.26,.91),(x,.281,1.23)],[.008,.008,.009,.005],navyLight,thigh,6)
    uv('Leather shoe '+suffix,(x,.15,.17),(.25,.43,.15),shoe,foot)
    uv('Shoe sole '+suffix,(x,.15,.071),(.255,.435,.055),navyShade,foot)
    tube('Shoe vamp '+suffix,[(x-.17,.28,.25),(x,.33,.28),(x+.17,.28,.25)],.009,navyShade,foot,8)
# Rounded stout suit, subtly asymmetric front and opening.
rings('Tailored jacket',[(1.32,.52,.29,-.01),(1.37,.64,.36,-.01),(1.70,.66,.39,.01),(2.03,.69,.40,.01),(2.29,.73,.37,0),(2.48,.79,.31,-.02),(2.60,.70,.28,-.03),(2.69,.37,.23,-.02)],navy,chest,48,2)
uv('Shirt neck',(0,.025,2.72),(.23,.22,.12),shirt,chest)
uv('Neck',(0,.005,2.88),(.225,.215,.22),skin,head)
patch('Shirt front',[(-.215,.355,2.62),(-.115,.425,2.34),(0,.443,2.03),(.115,.425,2.34),(.215,.355,2.62)],shirt,chest)
patch('Left notched lapel',[(-.27,.31,2.66),(-.59,.285,2.52),(-.46,.35,2.30),(-.58,.36,2.28),(-.08,.448,1.91),(-.16,.438,2.28)],navyLight,chest)
patch('Right notched lapel',[(.27,.31,2.66),(.59,.285,2.52),(.46,.35,2.30),(.58,.36,2.28),(.04,.454,1.88),(.16,.438,2.28)],navyLight,chest)
patch('Shirt collar inset',[(-.19,.245,2.78),(.19,.245,2.78),(.22,.40,2.58),(-.22,.40,2.58)],shirt,chest)
patch('Left shirt collar',[(-.18,.17,2.80),(0,.32,2.71),(-.12,.45,2.51),(-.30,.36,2.59)],shirt,chest)
patch('Right shirt collar',[(.18,.17,2.80),(0,.32,2.71),(.12,.45,2.51),(.30,.36,2.59)],shirt,chest)
patch('Red tie blade',[(-.064,.46,2.62),(-.105,.478,1.54),(0,.482,1.39),(.105,.478,1.54),(.064,.46,2.62)],red,chest,.035)
patch('Tie silk glint',[(.008,.502,2.42),(.014,.516,1.57),(.06,.507,1.54),(.036,.504,2.41)],redHi,chest,.003)
patch('Tie knot',[(-.081,.355,2.735),(-.061,.455,2.605),(.061,.455,2.605),(.081,.355,2.735)],red,chest,.055)
# Pockets and a small flag lapel pin, no lettering/branding.
for side in [-1,1]:
    patch('Jacket pocket '+str(side),[(side*.29,.38,1.73),(side*.54,.29,1.75),(side*.54,.295,1.71),(side*.29,.386,1.69)],navyLight,chest,.01)
uv('Jacket button',(0,.427,1.92),(.035,.022,.035),navyShade,chest,16,12)
patch('Lapel pin',[(.34,.365,2.46),(.45,.32,2.45),(.45,.326,2.37),(.34,.372,2.38)],gold,chest,.012)
for zz in [2.39,2.416,2.442]:tube('Pin stripe',[(.35,.382,zz),(.44,.341,zz-.01)],.007,red,chest,5)
# Sleeve anatomy follows shoulder/elbow/wrist pivots. Hands are actual rounded fists with thumbs/knuckles.
for side,suffix in [(-1,'L'),(1,'R')]:
    shoulder=(side*.72,-.015,2.48);elbow=(side*.91,.02,1.91);wrist=(side*.94,.11,1.41)
    upper=pivot('upper_arm.'+suffix,shoulder,chest);fore=pivot('forearm.'+suffix,elbow,upper);hand=pivot('hand.'+suffix,wrist,fore)
    uv('Sleeve shoulder '+suffix,(side*.77,-.015,2.36),(.255,.27,.30),navy,upper)
    tube('Upper sleeve '+suffix,[shoulder,(side*.85,0,2.22),elbow],[.225,.23,.20],navy,upper,24)
    uv('Soft elbow '+suffix,elbow,(.20,.205,.22),navy,fore)
    tube('Lower sleeve '+suffix,[elbow,(side*.94,.06,1.65),(side*.94,.105,1.46)],[.197,.187,.17],navy,fore,24)
    tube('Ivory cuff '+suffix,[(side*.94,.105,1.50),(side*.94,.113,1.38)],[.172,.168],shirt,fore,24)
    palm=uv('Fist palm '+suffix,(side*.94,.13,1.24),(.185,.18,.235),skin,hand)
    # Four curled fingers read from the front and hold together as one fist silhouette.
    for i in range(4):
        xx=side*.94+(i-1.5)*.078
        uv('Finger knuckle '+suffix+str(i),(xx,.275,1.26+(1-abs(i-1.5)/2)*.02),(.049,.057,.105),skin,hand,16,12)
    thumb=uv('Thumb '+suffix,(side*.80,.245,1.30),(.085,.095,.145),skin,hand,20,14);thumb.rotation_euler.y=side*.35
    for zz in [1.19,1.25]:tube('Hand crease '+suffix+str(zz),[(side*.85,.31,zz),(side*1.00,.30,zz-.005)],.0045,skinShade,hand,5)
# Sculpt base: fuse cranium, cheek planes, jowls, chin and nose into a continuous skin mesh.
parts=[]
parts.append(uv('Cranium',(0,-.005,3.48),(.62,.485,.65),skin,None,48,32))
parts.append(uv('Jaw',(0,.035,3.19),(.52,.405,.38),skin,None,40,28))
parts.append(uv('Chin',(0,.245,3.02),(.33,.25,.17),skin,None))
for side in [-1,1]:
    parts.append(uv('Cheek',(side*.38,.268,3.30),(.235,.224,.22),skin,None))
    parts.append(uv('Jowl',(side*.355,.17,3.13),(.20,.24,.225),skin,None))
parts.append(uv('Nose bridge',(0,.436,3.45),(.102,.125,.255),skin,None))
parts.append(uv('Nose tip',(0,.578,3.33),(.147,.17,.13),skin,None))
for side in [-1,1]:parts.append(uv('Nose wing',(side*.108,.526,3.286),(.083,.103,.063),skin,None))
bpy.ops.object.select_all(action='DESELECT')
for p in parts:p.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();sculpt=parts[0];sculpt.name='Continuous face sculpt'
rem=sculpt.modifiers.new('Fused skin','REMESH');rem.mode='VOXEL';rem.voxel_size=.018;bpy.ops.object.modifier_apply(modifier=rem.name)
sm=sculpt.modifiers.new('Sculpt polish','SMOOTH');sm.factor=.9;sm.iterations=6;bpy.ops.object.modifier_apply(modifier=sm.name)
dec=sculpt.modifiers.new('Game topology','DECIMATE');dec.ratio=.55;bpy.ops.object.modifier_apply(modifier=dec.name)
for p in sculpt.data.polygons:p.use_smooth=True
parent_keep(sculpt,head)
for side in [-1,1]:
    ear=uv('Ear '+str(side),(side*.605,-.005,3.36),(.105,.135,.19),skin,head)
    uv('Ear fold '+str(side),(side*.660,.077,3.365),(.034,.050,.12),skinShade,head,20,14)
    uv('Ear tragus '+str(side),(side*.638,.107,3.34),(.036,.042,.066),skin,head,20,14)
# Narrow pale eye sockets, hooded lids, blue-grey eyes and expressive brows.
for side in [-1,1]:
    x=side*.256
    uv('Pale eye socket '+str(side),(x,.442,3.522),(.207,.045,.105),skinLight,head)
    uv('Narrow eye '+str(side),(x,.482,3.526),(.139,.032,.052),white,head)
    uv('Iris '+str(side),(x-side*.009,.511,3.523),(.034,.015,.035),blue,head,20,14)
    uv('Pupil '+str(side),(x-side*.009,.525,3.523),(.016,.007,.024),black,head,16,10)
    uv('Eye glint '+str(side),(x-side*.009-.009,.533,3.534),(.007,.003,.008),white,head,12,8)
    # Upper lid slopes, covering the iris top for the recognizable squint.
    pts=bezier((x-.15,.483,3.548),(x-.07,.527,3.582),(x+.06,.526,3.573),(x+.15,.480,3.540),18)
    tube('Upper hooded eyelid '+str(side),pts,[.018+.015*math.sin(math.pi*i/17) for i in range(18)],skin,head,10)
    pts=bezier((x-.145,.473,3.506),(x-.07,.505,3.475),(x+.07,.505,3.477),(x+.15,.465,3.511),18)
    tube('Lower eyelid '+str(side),pts,.014,skinLight,head,10)
    pts=bezier((x-.177,.454,3.606),(x-.06,.483,3.641),(x+.07,.48,3.622),(x+.176,.438,3.596),20)
    tube('Raised brow plane '+str(side),pts,[.016+.020*math.sin(math.pi*i/19) for i in range(20)],skin,head,12)
    pts=[(xx,yy+.024,zz+.012) for xx,yy,zz in pts]
    tube('Blond eyebrow '+str(side),pts,[.007+.010*math.sin(math.pi*i/19) for i in range(20)],hairLow,head,8)
    # Under-eye bag crease and short outer crow line.
    pts=bezier((x-.12,.44,3.443),(x-.045,.477,3.426),(x+.09,.459,3.429),(x+.17,.426,3.473),15)
    tube('Eye bag crease '+str(side),pts,.0058,skinShade,head,6)
    uv('Nostril '+str(side),(side*.093,.622,3.273),(.038,.013,.018),skinShade,head,16,10)
    pts=bezier((side*.16,.52,3.27),(side*.245,.49,3.21),(side*.23,.49,3.135),(side*.205,.46,3.105),20)
    tube('Nasolabial fold '+str(side),pts,[.002+.004*math.sin(math.pi*i/19) for i in range(20)],skinShade,head,6)
# Characteristic small pursed mouth, not a fixed cartoon smile.
uv('Mouth muzzle',(0,.40,3.16),(.22,.09,.10),skin,head)
uv('Lower pursed lip',(0,.488,3.123),(.125,.035,.034),lip,head,28,16)
pts=bezier((-.138,.479,3.169),(-.06,.521,3.185),(.07,.521,3.185),(.138,.479,3.169),24)
tube('Upper pursed lip',pts,[.009+.010*math.sin(math.pi*i/23) for i in range(24)],lip,head,10)
pts=bezier((-.128,.487,3.157),(-.04,.523,3.146),(.05,.523,3.146),(.128,.487,3.157),24)
tube('Mouth line',pts,.0055,skinShade,head,8)
# Hair cap plus swept continuous sculpted comb-over, with restrained directional strands.
cap=uv('Hair cap',(0,-.05,3.921),(.625,.478,.303),hair,head,48,28)
# Nape hair covers the back and neatly ends above ears.
uv('Back hair',(0,-.345,3.71),(.49,.17,.30),hair,head,36,24)
for side in [-1,1]:uv('Sideburn '+str(side),(side*.571,.025,3.70),(.073,.20,.175),hair,head,24,16)
# Main forelock travels in a broad side-swept wave across the forehead.
pts=bezier((-.55,.22,3.86),(-.53,.53,4.20),(.21,.58,4.265),(.56,.16,4.03),36)
rad=[(.07+.11*math.sin(math.pi*i/35),.04+.09*math.sin(math.pi*i/35)) for i in range(36)]
tube('Sculpted swept forelock',pts,rad,hair,head,20)
# Secondary wave overlaps the main ribbon organically.
pts=bezier((-.59,.045,3.88),(-.49,.32,4.22),(.19,.35,4.28),(.52,-.06,4.10),36)
tube('Crown comb-over',pts,[(.055+.10*math.sin(math.pi*i/35),.04+.075*math.sin(math.pi*i/35)) for i in range(36)],hair,head,18)
for i in range(9):
    off=(i-4)*.028
    pts=bezier((-.548,.245+off,3.90+i*.002),(-.46,.58+off,4.16+i*.005),(.22,.59+off*.35,4.23+i*.004),(.56,.20+off,4.04+i*.003),30)
    tube('Comb-over strand %02d'%i,pts,[.0015+.0055*math.sin(math.pi*j/29) for j in range(30)],hairHi if i%3 else hairLow,head,6)
for side in [-1,1]:
    for i in range(4):
        pts=bezier((side*.58,.15-i*.06,3.81),(side*.61,.08-i*.06,3.80),(side*.60,-.02-i*.06,3.74),(side*.55,-.07-i*.06,3.69),14)
        tube('Side hair strand',pts,.005,hairHi,head,6)
# Forehead creases are understated; preserve a readable stylized skin silhouette.
for z,w in [(3.72,.29),(3.765,.24)]:
    pts=bezier((-w,.433,z),(0,.478,z+.012),(0,.478,z+.012),(w,.433,z),24)
    tube('Forehead crease',pts,.0035,skinShade,head,6)
# Fuse each sleeve to remove intersecting primitive seams while preserving elbow pivots.
for name in ['upper_arm.L','upper_arm.R','forearm.L','forearm.R']:
    objects=[o for o in scene.objects if o.type=='MESH' and o.parent==nodes[name] and o.data.materials[0]==navy]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=objects[0]
    rem=o.modifiers.new('Continuous wool surface','REMESH');rem.mode='VOXEL';rem.voxel_size=.022;bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=o.modifiers.new('Sleeve polish','SMOOTH');sm.factor=.8;sm.iterations=4;bpy.ops.object.modifier_apply(modifier=sm.name)
    for p in o.data.polygons:p.use_smooth=True
# Keep only original model geometry in export. Merge per articulated part/material to reduce draw calls.
model_objects=[o for o in scene.objects if o.type=='MESH']
for p in list(nodes.values()):
    groups={}
    for o in list(scene.objects):
        if o.type=='MESH' and o.parent==p:
            key=o.data.materials[0].name if o.data.materials else 'none';groups.setdefault(key,[]).append(o)
    for key,objects in groups.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=p.name+'__'+key.replace(' ','_')
# Reduce smooth game geometry while preserving small face details and all articulated nodes.
for o in list(scene.objects):
    if o.type!='MESH':continue
    o.data.calc_loop_triangles()
    if len(o.data.loop_triangles)>1000:
        dec=o.modifiers.new('Game optimized surface','DECIMATE');dec.ratio=.43
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=dec.name)
# Reparent correctly and preserve root identity. Export only model before adding studio set.
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(D/'captain-trump-v4.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False)
stats={'asset':'captain-trump-v4.glb','authorship':'Original geometry and materials generated for Strait Escape; no third-party meshes or textures.','height':4.35,'coordinate_system':'glTF Y-up; face/front is -Z; feet at Y=0','nodes':list(nodes),'meshes':len([o for o in scene.objects if o.type=='MESH']),'triangles':sum(len(o.data.loop_triangles) for o in scene.objects if o.type=='MESH')}
for o in scene.objects:
    if o.type=='MESH':o.data.calc_loop_triangles()
stats['triangles']=sum(len(o.data.loop_triangles) for o in scene.objects if o.type=='MESH')
json.dump(stats,open(D/'model-contract.json','w'),indent=2)
# Studio preview: neutral editorial, soft key + rim. No live game modifications.
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=96;scene.cycles.use_denoising=False;scene.cycles.max_bounces=6
scene.render.resolution_x=1200;scene.render.resolution_y=1400;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.15
world=bpy.data.worlds.new('Studio world');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.17,.23,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
floor=mat('Studio floor','D6DDE3',.85)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.005));o=bpy.context.object;o.name='Studio ground';o.data.materials.append(floor)
def light(name,loc,power,size,color):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,2.3))-o.location).to_track_quat('-Z','Y').to_euler()
light('Large warm key',(-4,6,8),900,5,(1,.88,.74));light('Soft fill',(5,4,5),500,4,(.76,.87,1));light('Hair rim',(1,-4,7),1100,3,(1,.86,.62))
bpy.ops.object.camera_add(location=(6.5,13,6.5));camera=bpy.context.object;camera.name='Portrait camera';camera.rotation_euler=(Vector((0,0,2.12))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=5.2;scene.camera=camera
bpy.ops.wm.save_as_mainfile(filepath=str(D/'captain-trump-preview-v4.blend'))
scene.render.filepath=str(D/'captain-trump-v4-three-quarter.png');bpy.ops.render.render(write_still=True)
print('MODEL_COMPLETE',json.dumps(stats),flush=True)
