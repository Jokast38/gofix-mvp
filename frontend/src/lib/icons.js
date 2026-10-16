import {
  BatteryCharging, Bike, BookOpen, BrickWall, Brush, Cake, Camera, Car, ChefHat, Code, Droplets, Dumbbell, Flame, Globe,
  GraduationCap, Grid2x2, Hammer, HeartPulse, House, Laptop, Leaf, Lock, Package, Paintbrush, PartyPopper, PenTool,
  Scissors, Shirt, ShoppingBasket, Smartphone, Sparkles, Target, Truck, WashingMachine, Wifi, Wind, Wrench, Zap,
} from "lucide-react";

const ICONS = {
  "battery-charging": BatteryCharging, bike: Bike, "book-open": BookOpen, "brick-wall": BrickWall, brush: Brush, cake: Cake,
  camera: Camera, car: Car, "chef-hat": ChefHat, code: Code, droplets: Droplets, dumbbell: Dumbbell, flame: Flame, globe: Globe,
  "graduation-cap": GraduationCap, "grid-2x2": Grid2x2, hammer: Hammer, "heart-pulse": HeartPulse, house: House, laptop: Laptop,
  leaf: Leaf, lock: Lock, package: Package, paintbrush: Paintbrush, "party-popper": PartyPopper, "pen-tool": PenTool,
  scissors: Scissors, shirt: Shirt, "shopping-basket": ShoppingBasket, smartphone: Smartphone, sparkles: Sparkles, target: Target,
  truck: Truck, "washing-machine": WashingMachine, wifi: Wifi, wind: Wind, wrench: Wrench, zap: Zap,
};

export const iconFor = (name) => ICONS[name] || Wrench;

// Neon colour cycle from the brand charter (electric blue, magenta, orange, violet)
const NEON = ["var(--brand-electric)", "var(--brand-pink)", "var(--brand-orange)", "var(--brand-violet)"];
export const neonFor = (i) => NEON[i % NEON.length];
