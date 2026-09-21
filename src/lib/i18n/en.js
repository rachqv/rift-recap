// English is the source language and the fallback for every other one, so it is imported directly (no loading, no await),
// which also lets plain functions default to an English `t`.
import { flatten } from "./flatten";
import { createT } from "./translate";
import badges from "../../messages/en/badges.json";
import cards from "../../messages/en/cards.json";
import chart from "../../messages/en/chart.json";
import clash from "../../messages/en/clash.json";
import common from "../../messages/en/common.json";
import demo from "../../messages/en/demo.json";
import errors from "../../messages/en/errors.json";
import forms from "../../messages/en/forms.json";
import heatmap from "../../messages/en/heatmap.json";
import home from "../../messages/en/home.json";
import insights from "../../messages/en/insights.json";
import persona from "../../messages/en/persona.json";
import players from "../../messages/en/players.json";
import quiz from "../../messages/en/quiz.json";
import recap from "../../messages/en/recap.json";
import rhythm from "../../messages/en/rhythm.json";
import search from "../../messages/en/search.json";
import share from "../../messages/en/share.json";
import squad from "../../messages/en/squad.json";
import story from "../../messages/en/story.json";
import versus from "../../messages/en/versus.json";

const tree = { badges, cards, chart, clash, common, demo, errors, forms, heatmap, home, insights, persona, players, quiz, recap, rhythm, search, share, squad, story, versus };

const EN = Object.fromEntries(Object.entries(tree).map(([namespace, messages]) => [namespace, flatten(messages, namespace)]));
export const EN_FLAT = Object.assign({}, ...Object.values(EN));

/** An English `t`. Lib functions take `t` as an argument and use this when nobody gives them one. */
export const defaultT = createT("en", EN_FLAT);
