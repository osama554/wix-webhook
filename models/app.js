import mongoose from "mongoose";

const appSchema = new mongoose.Schema({
    appId: {
        type: String,
        required: true,
    },
    instanceId: {
        type: String,
        required: true,
    },
    metaSiteId: {
        type: String,
        required: true,
    },
    products: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
    },
    timestamps: true
});

const App = mongoose.models.App || mongoose.model("App", appSchema);

export default App;
