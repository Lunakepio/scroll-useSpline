import { Suspense, useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Loader,
  OrbitControls,
  ScrollControls,
  Scroll,
  useScroll,
  Float,
  Box,
  Stats,
  PerspectiveCamera,
  Html,
  Environment,
  Lightformer,
  Text3D,
  Text,
  Preload,
  CubeCamera,
} from "@react-three/drei";
import * as THREE from "three";
import {
  Bloom,
  EffectComposer,
  BrightnessContrast,
  LUT,
  HueSaturation,
} from "@react-three/postprocessing";
import { BlendFunction, LUTCubeLoader } from "postprocessing";
import { MeshReflectorMaterial, RoundedBox } from "@react-three/drei";
import { LinearEncoding, RepeatWrapping, TextureLoader } from "three";

import { ModelFour } from "./Porsche930";
import { useSpline } from "./useSpline";

function App() {
  // function CurvedLine({ lightRef }) {
  //   const meshRef = useRef();

  //   useFrame(() => {
  //     if (lightRef.current && meshRef.current) {
  //       const points = [];
  //       const curveResolution = 50;
  //       const curveRadius = 2;

  //       for (let i = 0; i < curveResolution; i++) {
  //         const t = i / (curveResolution - 1);
  //         const angle = t * Math.PI * 2;
  //         const x = Math.cos(angle) * curveRadius;
  //         const y = lightRef.current.position.y;
  //         const z = Math.sin(angle) * curveRadius;
  //         points.push(new THREE.Vector3(x, y, z));
  //       }

  //       const curve = new THREE.CatmullRomCurve3(points);
  //       const tubeGeometry = new THREE.TubeGeometry(curve, curveResolution, 0.01, 8, false);
  //       meshRef.current.geometry = tubeGeometry;
  //     }
  //   });

  //   return (
  //     <mesh ref={meshRef}>
  //       <tubeGeometry />
  //       <meshStandardMaterial color={"#54E5FF"} emissive={"#00FFF6"} toneMapped={false} />
  //     </mesh>
  //   );
  // }

  function Composer() {
    const texture = useLoader(LUTCubeLoader, "/assets/F-6800-STD.cube");

    return (
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={1} intensity={1.25} levels={9} mipmapBlur />
        <LUT lut={texture} />
        <BrightnessContrast brightness={0} contrast={0.1} />
      </EffectComposer>
    );
  }

  function Walls() {
    return (
      <group position-z={-15}>
        <mesh position-y={3} scale={0.8}>
          <planeGeometry args={[16, 9]} />
          <meshStandardMaterial emissive="#ffffff" toneMapped={false} />
        </mesh>

        <spotLight
          color={[1, 1, 1]}
          intensity={0.2}
          angle={0.6}
          penumbra={0.5}
          position={[0, 10, 0]}
          castShadow
          shadow-bias={-0.0001}
        />
        <pointLight
          color={[1, 1, 1]}
          intensity={0.2}
          position={[0, 10, 0]}
          castShadow
          shadow-bias={-0.0001}
        />
      </group>
    );
  }

  function Ground() {
    // thanks to https://polyhaven.com/a/rough_plasterbrick_05 !
    const textures = useMemo(() => {
      const loader = new TextureLoader();
      const roughnessTexture = loader.load("assets/terrain-roughness.jpg");
      const normalTexture = loader.load("assets/terrain-normal.jpg");
      return [roughnessTexture, normalTexture];
    }, []);

    const [roughness, normal] = textures;

    useEffect(() => {
      [normal, roughness].forEach((t) => {
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
        t.repeat.set(5, 5);
        t.offset.set(0, 0);
      });

      normal.encoding = LinearEncoding;
    }, [normal, roughness]);


    return (
      <mesh
        rotation-x={-Math.PI * 0.5}
        position={[0, -2.1, 0]}
        castShadow
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <MeshReflectorMaterial
          envMapIntensity={0}
          normalMap={normal}
          normalScale={[0.15, 0.15]}
          roughnessMap={roughness}
          dithering={true}
          color={[0.015, 0.015, 0.015]}
          roughness={0.7}
          blur={[1000, 400]} // Blur ground reflections (width, heigt), 0 skips blur
          mixBlur={30} // How much blur mixes with surface roughness (default = 1)
          mixStrength={80} // Strength of the reflections
          mixContrast={1} // Contrast of the reflections
          resolution={1024} // Off-buffer resolution, lower=faster, higher=better quality, slower
          mirror={0} // Mirror environment, 0 = texture colors, 1 = pick up env colors
          depthScale={0.01} // Scale the depth factor (0 = no depth, default = 0)
          minDepthThreshold={0.9} // Lower edge for the depthTexture interpolation (default = 0)
          maxDepthThreshold={1} // Upper edge for the depthTexture interpolation (default = 0)
          depthToBlurRatioBias={0.25} // Adds a bias factor to the depthTexture before calculating the blur amount [blurFactor = blurTexture * (depthTexture + bias)]. It accepts values between 0 and 1, default is 0.25. An amount > 0 of bias makes sure that the blurTexture is not too sharp because of the multiplication with the depthTexture
          debug={0}
          reflectorOffset={0.2} // Offsets the virtual camera that projects the reflection. Useful when the reflective surface is some distance from the object's origin (default = 0)
        />
      </mesh>
    );
  }

  function Camera() {
    const cameraRef = useRef();
    let data = useScroll();
    const textRef = useRef();
    const dateRef = useRef();
    const subRef = useRef();
    const lookAtTarget = useRef();

    const { points, loading, error } = useSpline("porscheCurve.json");
    const [speedFactor, setSpeedFactor] = useState(1);
    const [pointest, setPointest] = useState([]);
    const [currentPoint, setCurrentPoint] = useState(0);

    useEffect(() => {
      if (points) {
        setPointest(points);
        setCurrentPoint(points.length - 1);
      }
    }, [points]);
    useFrame((state, delta) => {
  // Ensure we have points to work with
  if (!pointest.length) return;


  const targetIndex = Math.floor(data.offset * (pointest.length - 1));
  const targetPoint = pointest[targetIndex];


  // cameraRef.current.position.copy(targetPoint);
  cameraRef.current.position.lerp(targetPoint, delta * speedFactor);


  cameraRef.current.lookAt(lookAtTarget.current.position);

  setCurrentPoint(targetIndex);

    });

    // rotation={[rot.x, rot.y, rot.z]} position={[pos.x, pos.y, pos.z]}
    return (
      <>
     <mesh ref={lookAtTarget} position={[0, -2.21, -5]}></mesh>
        <PerspectiveCamera ref={cameraRef} makeDefault />
      </>
    );
  }

  return (
    <>
      <Canvas
        gl={{
          powerPreference: "low-power",
          antialias: false,
          stencil: false,
        }}
      >
        <color attach="background" args={["#000000"]} />
        <Suspense fallback={null}>
          <ScrollControls pages={9} damping={0.1}>
            <Camera />
          </ScrollControls>
          <ModelFour position={[0, -2.21, -5]} rotation-y={-Math.PI * 0.75} />
          <Walls />
          <Ground />
          <ambientLight intensity={0.5} />
          <pointLight position={[0, 10, 0]} intensity={0.5} />

          <Environment frames={1} resolution={512}>
            <group rotation={[0, 0, 1]}>
              <Lightformer
                form="circle"
                intensity={10}
                position={[0, 10, -10]}
                scale={20}
                onUpdate={(self) => self.lookAt(0, 0, 0)}
              />
              <Lightformer
                intensity={0.1}
                onUpdate={(self) => self.lookAt(0, 0, 0)}
                position={[-5, 1, -1]}
                rotation-y={Math.PI / 2}
                scale={[50, 10, 1]}
              />
              <Lightformer
                intensity={0.1}
                onUpdate={(self) => self.lookAt(0, 0, 0)}
                position={[10, 1, 0]}
                rotation-y={-Math.PI / 2}
                scale={[50, 10, 1]}
              />
              <Lightformer
                color="white"
                intensity={0.2}
                onUpdate={(self) => self.lookAt(0, 0, 0)}
                position={[0, 1, 0]}
                scale={[10, 100, 1]}
              />
              <Lightformer
                color="white"
                intensity={0.2}
                onUpdate={(self) => self.lookAt(0, 0, 0)}
                position={[-20, 1, 0]}
                scale={[10, 100, 1]}
              />
            </group>
          </Environment>
          <fog attach="fog" args={["#000000", 20, 30]} />
          <Composer />
          <Stats />
        </Suspense>
        <Preload all />
      </Canvas>
      <Loader />
    </>
  );
}

export default App;
