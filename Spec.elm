port module Spec exposing (..)

import Debug
import Feature
import Html exposing (..)
import Html.App as Html
import Html.Attributes exposing (class, value, id)
import Html.Events exposing (onClick, on, targetValue)
import IntDict exposing (IntDict)
import IntDict.Safe as IntDict
import Json.Decode as Decode exposing ((:=))
import Json.Encode as Encode
import Result
import UndoList as UL
import UndoRedo as UR

-- Model

type alias Model = 
    { isEditingTitle: Bool
    , features: IntDict Feature.Model
    , nextUid: Int
    , title: String
    }


titleId : String
titleId = "idTitle"


init : Encode.Value -> Model
init json = 
    Decode.decodeValue decoder json
    |> Result.withDefault 
        { features = IntDict.empty
        , nextUid = 0
        , title = "Untitled"
        , isEditingTitle = False
        }


decoder : Decode.Decoder Model
decoder =
    let
        featureDecoder : Decode.Decoder (IntDict Feature.Model)
        featureDecoder =
            Feature.decoder
            |> Decode.map (\feature -> (feature.uid, feature))
            |> Decode.list
            |> Decode.map IntDict.fromList
    in
    Decode.object3 (Model False)
        ("features" := featureDecoder)
        ("nextUid" := Decode.int)
        ("title" := Decode.string)


encode : Model -> Encode.Value
encode { features, nextUid, title, isEditingTitle } =
    Encode.object
        [ ("title", Encode.string title)
        , ("nextUid", Encode.int nextUid)
        , ("features", IntDict.values features |> List.map Feature.encode |> Encode.list)
        ]


-- Msg

type Msg
    = NewFeature
    | FeatureUpdate Int Feature.Msg
    | FocusFeature String
    | LoadSpec Model
    | SaveSpec String
    | EditTitle
    | SubmitTitle String
    | RequestRedraw
    | DiffSpec String
    | NoOp


-- Update

type alias SaveInfo =
    { filename: String
    , specJson: String
    }

port saveSpec : SaveInfo -> Cmd msg
port diffSpec : SaveInfo -> Cmd msg
port focus : String -> Cmd msg


checkToDelete : Int -> Maybe Feature.Event -> IntDict Feature.Model -> IntDict Feature.Model
checkToDelete index maybeDeleteEvent features =
    case maybeDeleteEvent of
        Just Feature.Delete ->
            IntDict.safeRemove index features |> Result.withDefault features

        _ ->
            features


update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
    case msg of
        NewFeature ->
            (
                { model 
                | features = 
                    let 
                        newFeature : Feature.Model
                        newFeature = 
                            Feature.init model.nextUid ("Feature " ++ toString model.nextUid)
                    in
                    IntDict.safeInsert model.nextUid newFeature model.features
                    |> Result.withDefault model.features

                , nextUid = model.nextUid + 1
                }
            ,   Cmd.none
            )

        FeatureUpdate index featureMsg ->
            (   { model
                | features =
                    IntDict.safeGet 
                        index 
                        model.features
                    |> Result.withDefault Nothing
                    |> Maybe.map (Feature.update featureMsg)
                    |> Maybe.map (\(newFeature, maybeFeatureEvent) -> 
                        IntDict.safeInsert index newFeature model.features
                        |> Result.withDefault model.features
                        |> checkToDelete index maybeFeatureEvent)
                    |> Maybe.withDefault model.features
                }
            ,   Cmd.none
            )

        FocusFeature id ->
            (model, focus id)

        LoadSpec newModel ->
            (newModel, Cmd.none)

        SaveSpec filename ->
            (   model
            ,   encode model
                |> Encode.encode 0
                |> SaveInfo filename
                |> saveSpec
            )

        EditTitle ->
            ({ model | isEditingTitle = True }, focus titleId)

        SubmitTitle newTitle ->
            (   { model 
                | title = if newTitle /= "" then newTitle else model.title
                , isEditingTitle = False
                }
            ,   Cmd.none
            )

        RequestRedraw ->
            (model, if model.isEditingTitle then focus titleId else Cmd.none)

        DiffSpec filename ->
            (   model
            ,   encode model
                |> Encode.encode 0
                |> SaveInfo filename
                |> diffSpec
            )

        NoOp ->
            (model, Cmd.none)


-- View

view : Model -> Html Msg
view { features, nextUid, title, isEditingTitle } =
    let 
        viewFeature : Int -> Feature.Model -> Html Msg
        viewFeature index feature =
            Html.map (FeatureUpdate index) (Feature.view feature)

        viewTitle : Html Msg
        viewTitle =
            if isEditingTitle then
                div [ class "title" ]
                    [ input 
                        [ class "title"
                        , id titleId
                        , on "blur" (Decode.map SubmitTitle targetValue) 
                        , on "change" (Decode.map SubmitTitle targetValue) 
                        , value title
                        ] []
                    ]
            else
            h1  [ class "title", onClick EditTitle ]
                [ text title ]

        featureButton : Int -> Feature.Model -> Html Msg
        featureButton index feature =
            div []
                [ button 
                    [ class "navbar-feature-button"
                    , onClick (FocusFeature (Feature.getId index))
                    ] 
                    [ text feature.name ] 
                ]
    in
    div []
        [   div [ class "content-wrapper" ]
                (   viewTitle
                ::  (IntDict.map viewFeature features |> IntDict.values)
                ++  [   div [ class "add-button-parent" ]
                            [ button 
                                [ onClick NewFeature
                                , class "add-button" 
                                ] 
                                [ text "New Feature" 
                                ]
                            ]
                    ]
                )
        ,   div [ class "navbar" ] 
                (   b [ class "navbar-title" ] [ text "Features" ]
                ::  hr [] []
                ::  (IntDict.map featureButton features |> IntDict.values)
                )
        ]


-- Subscriptions

port loadSpec : (String -> msg) -> Sub msg
port saveSpecTrigger : (String -> msg) -> Sub msg
port diffSpecTrigger : (String -> msg) -> Sub msg
port requestRedraw : ({} -> msg) -> Sub msg
port undo : ({} -> msg) -> Sub msg
port redo : ({} -> msg) -> Sub msg


subscriptions : Model -> Sub (UL.Msg Msg)
subscriptions _ =
    let
        parseOpenedSpec : String -> Msg
        parseOpenedSpec json =
            Decode.decodeString decoder json
            |> Result.map LoadSpec
            |> Result.withDefault NoOp
    in
    Sub.batch
        [ UR.subMapNew loadSpec parseOpenedSpec
        , UR.subMapNew saveSpecTrigger SaveSpec
        , UR.subMapNew diffSpecTrigger DiffSpec
        , UR.subMapNew requestRedraw (\_ -> RequestRedraw)
        , undo (\_ -> UL.Undo)
        , redo (\_ -> UL.Redo)
        ]


-- Main

main =
    Html.programWithFlags
        { init = UR.initWithFlags (\flags -> (init flags, Cmd.none))
        , view = UR.view (view >> Html.map UL.New)
        , update = UR.update update
        , subscriptions = UR.subscriptions subscriptions
        }
