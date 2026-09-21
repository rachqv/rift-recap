import Backdrop from "./Backdrop";
import ChampionSlides from "./ChampionSlides";

export default function Background({ showChampions = true }) {
  return <Backdrop>{showChampions && <ChampionSlides />}</Backdrop>;
}
