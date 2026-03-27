import { motion } from "framer-motion";

const AnimatedLines = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <svg
        className="w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Linha suave principal */}
        <motion.path
          d="M-100 400 C400 200, 800 600, 1200 350 S1800 500, 2020 300"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1, 0],
            opacity: [0, 0.12, 0.12, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
            times: [0, 0.4, 0.6, 1],
          }}
        />

        {/* Linha complementar */}
        <motion.path
          d="M2020 700 C1500 500, 1000 800, 500 600 S-100 750, -100 650"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 1, 1, 0],
            opacity: [0, 0.08, 0.08, 0],
          }}
          transition={{
            duration: 24,
            delay: 5,
            repeat: Infinity,
            ease: "easeInOut",
            times: [0, 0.4, 0.6, 1],
          }}
        />
      </svg>

      {/* Glow sutil flutuante */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[120px]"
        animate={{
          x: ["-10%", "60%", "30%", "-10%"],
          y: ["10%", "50%", "80%", "10%"],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
};

export default AnimatedLines;
