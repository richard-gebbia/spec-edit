port module Spec exposing (..)

import Debug
import Requirement
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
    , requirements: IntDict Requirement.Model
    , nextUid: Int
    , title: String
    }


titleId : String
titleId = "idTitle"


init : Encode.Value -> Model
init json = 
    Decode.decodeValue decoder json
    |> Result.withDefault 
        { requirements = IntDict.empty
        , nextUid = 0
        , title = "Untitled"
        , isEditingTitle = False
        }


decoder : Decode.Decoder Model
decoder =
    let
        requirementDecoder : Decode.Decoder (IntDict Requirement.Model)
        requirementDecoder =
            Requirement.decoder
            |> Decode.map (\requirement -> (requirement.uid, requirement))
            |> Decode.list
            |> Decode.map IntDict.fromList
    in
    Decode.object3 (Model False)
        ("requirements" := requirementDecoder)
        ("nextUid" := Decode.int)
        ("title" := Decode.string)


encode : Model -> Encode.Value
encode { requirements, nextUid, title, isEditingTitle } =
    Encode.object
        [ ("title", Encode.string title)
        , ("nextUid", Encode.int nextUid)
        , ("requirements", IntDict.values requirements |> List.map Requirement.encode |> Encode.list)
        ]


-- Msg

type Msg
    = NewRequirement
    | RequirementUpdate Int Requirement.Msg
    | FocusRequirement String
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


checkToDelete : Int -> Maybe Requirement.Event -> IntDict Requirement.Model -> IntDict Requirement.Model
checkToDelete index maybeDeleteEvent requirements =
    case maybeDeleteEvent of
        Just Requirement.Delete ->
            IntDict.safeRemove index requirements |> Result.withDefault requirements

        _ ->
            requirements


update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
    case msg of
        NewRequirement ->
            (
                { model 
                | requirements = 
                    let 
                        newRequirement : Requirement.Model
                        newRequirement = 
                            Requirement.init model.nextUid ("Requirement " ++ toString model.nextUid)
                    in
                    IntDict.safeInsert model.nextUid newRequirement model.requirements
                    |> Result.withDefault model.requirements

                , nextUid = model.nextUid + 1
                }
            ,   Cmd.none
            )

        RequirementUpdate index requirementMsg ->
            (   { model
                | requirements =
                    IntDict.safeGet 
                        index 
                        model.requirements
                    |> Result.withDefault Nothing
                    |> Maybe.map (Requirement.update requirementMsg)
                    |> Maybe.map (\(newRequirement, maybeRequirementEvent) -> 
                        IntDict.safeInsert index newRequirement model.requirements
                        |> Result.withDefault model.requirements
                        |> checkToDelete index maybeRequirementEvent)
                    |> Maybe.withDefault model.requirements
                }
            ,   Cmd.none
            )

        FocusRequirement id ->
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
view { requirements, nextUid, title, isEditingTitle } =
    let 
        viewRequirement : Int -> Requirement.Model -> Html Msg
        viewRequirement index requirement =
            Html.map (RequirementUpdate index) (Requirement.view requirement)

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

        featureButton : Int -> Requirement.Model -> Html Msg
        featureButton index requirement =
            div []
                [ button 
                    [ class "navbar-requirement-button"
                    , onClick (FocusRequirement (Requirement.getId index))
                    ] 
                    [ text requirement.name ] 
                ]
    in
    div []
        [   div [ class "content-wrapper" ]
                (   viewTitle
                ::  (IntDict.map viewRequirement requirements |> IntDict.values)
                ++  [   div [ class "add-button-parent" ]
                            [ button 
                                [ onClick NewRequirement
                                , class "add-button" 
                                ] 
                                [ text "New Requirement" 
                                ]
                            ]
                    ]
                )
        ,   div [ class "navbar" ] 
                (   b [ class "navbar-title" ] [ text "Requirements" ]
                ::  hr [] []
                ::  (IntDict.map featureButton requirements |> IntDict.values)
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
